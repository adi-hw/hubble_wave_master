import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  FileText,
  Database,
  Users,
  Book,
  ShoppingBag,
  Loader2,
  Sparkles,
  ArrowRight,
  Clock,
  Command,
} from 'lucide-react';
import { searchService, GlobalSearchResult } from '../services/search';

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'knowledge':
      return Book;
    case 'catalog':
      return ShoppingBag;
    case 'user':
      return Users;
    case 'collection':
      return Database;
    default:
      return FileText;
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'knowledge':
      return 'Knowledge';
    case 'catalog':
      return 'Catalog';
    case 'user':
      return 'User';
    case 'collection':
      return 'Collection';
    case 'record':
      return 'Record';
    default:
      return 'Item';
  }
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('hw-recent-searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Check AI availability
  useEffect(() => {
    searchService.isAvailable().then(setAiAvailable);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        const searchResults = await searchService.globalSearch(searchQuery, { limit: 10 });
        setResults(searchResults);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (query.trim()) {
      setLoading(true);
      performSearch(query);
    } else {
      setResults([]);
    }
  }, [query, performSearch]);

  // Save to recent searches
  const saveRecentSearch = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('hw-recent-searches', JSON.stringify(updated));
  };

  // Handle result selection
  const handleSelect = (result: GlobalSearchResult) => {
    if (result.url) {
      saveRecentSearch(query);
      navigate(result.url);
      onClose();
    }
  };

  // Handle recent search selection
  const handleRecentSearch = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, results.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-overlay/50 backdrop-blur-sm" />

      {/* Search Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl overflow-hidden bg-card border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search records, knowledge base, catalog..."
            className="flex-1 bg-transparent text-lg outline-none text-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
            ESC
          </div>
        </div>

        {/* AI Status Badge */}
        {aiAvailable !== null && (
          <div
            className={`px-5 py-2 flex items-center gap-2 text-xs ${
              aiAvailable ? 'bg-success-subtle text-success-text' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiAvailable ? 'AI-powered semantic search active' : 'AI search unavailable, using basic search'}
          </div>
        )}

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto [scrollbar-width:thin]"
        >
          {/* No Query - Show Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-xs font-medium flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Recent Searches
              </div>
              {recentSearches.map((search, i) => (
                <button
                  key={i}
                  onClick={() => handleRecentSearch(search)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 rounded-xl hover:bg-muted text-left"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* No Query, No Recent - Show Tips */}
          {!query && recentSearches.length === 0 && (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-2 text-foreground">
                Search across your workspace
              </p>
              <p className="text-sm text-muted-foreground">
                Find records, knowledge articles, catalog items, and more
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Command className="h-3.5 w-3.5" />
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">
                  ⌘K
                </kbd>
                <span>to open search anytime</span>
              </div>
            </div>
          )}

          {/* Search Results */}
          {query && results.length > 0 && (
            <div className="p-2">
              {results.map((result, i) => {
                const Icon = getTypeIcon(result.type);
                const isSelected = i === selectedIndex;

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={`w-full px-4 py-3 flex items-start gap-4 rounded-xl text-left transition-colors ${
                      isSelected ? 'bg-muted' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="p-2 rounded-lg flex-shrink-0 bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-foreground">
                          {result.title}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.description && (
                        <p className="text-sm mt-0.5 line-clamp-2 text-muted-foreground">
                          {result.description}
                        </p>
                      )}
                      {result.relevance && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          {Math.round(result.relevance * 100)}% match
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {query && !loading && results.length === 0 && (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-1 text-foreground">
                No results found
              </p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or check your spelling
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between text-xs border-t border-border bg-muted text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-card">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-card">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-card">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by AVA
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage global search state
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
