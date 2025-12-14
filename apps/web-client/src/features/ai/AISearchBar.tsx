import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Loader2,
  FileText,
  ShoppingCart,
  Database,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface AISearchBarProps {
  className?: string;
  placeholder?: string;
  onResultSelect?: (result: SearchResult) => void;
}

const sourceTypeIcons: Record<string, React.ElementType> = {
  knowledge_article: FileText,
  catalog_item: ShoppingCart,
  record: Database,
};

const sourceTypeLabels: Record<string, string> = {
  knowledge_article: 'Knowledge Article',
  catalog_item: 'Service Catalog',
  record: 'Record',
};

export function AISearchBar({
  className,
  placeholder = 'AI-powered search...',
  onResultSelect,
}: AISearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/ai/embeddings/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            limit: 8,
            threshold: 0.5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      // Navigate to the source
      const path = getSourcePath(result);
      if (path) {
        navigate(path);
      }
    }
    setIsOpen(false);
    setQuery('');
  };

  const getSourcePath = (result: SearchResult): string | null => {
    const metadata = result.metadata || {};
    switch (result.sourceType) {
      case 'knowledge_article':
        return `/portal/knowledge/${result.sourceId}`;
      case 'catalog_item':
        return `/portal/catalog/${result.sourceId}`;
      case 'record':
        if (metadata.collectionName && metadata.recordId) {
          return `/data/${metadata.collectionName}/${metadata.recordId}`;
        }
        return null;
      default:
        return null;
    }
  };

  const getTitle = (result: SearchResult): string => {
    const metadata = result.metadata || {};
    return (
      (metadata.title as string) ||
      (metadata.label as string) ||
      (metadata.displayValue as string) ||
      result.sourceId
    );
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-14 pr-10 py-2.5 rounded-xl',
            'bg-slate-100 dark:bg-slate-800',
            'border border-transparent',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            'text-slate-900 dark:text-white placeholder:text-slate-500',
            'outline-none transition-all'
          )}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          </div>
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (query.trim() || results.length > 0) && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-2 z-50',
            'bg-white dark:bg-slate-900 rounded-xl shadow-xl',
            'border border-slate-200 dark:border-slate-700',
            'max-h-[400px] overflow-y-auto'
          )}
        >
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = sourceTypeIcons[result.sourceType] || FileText;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      'w-full px-4 py-3 flex items-start gap-3 text-left',
                      'hover:bg-slate-50 dark:hover:bg-slate-800',
                      'transition-colors',
                      index === selectedIndex && 'bg-slate-50 dark:bg-slate-800'
                    )}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {getTitle(result)}
                        </p>
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                          {sourceTypeLabels[result.sourceType] || result.sourceType}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {result.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'text-xs',
                            result.similarity > 0.8
                              ? 'text-green-600'
                              : result.similarity > 0.6
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          )}
                        >
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="flex-shrink-0 w-4 h-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          ) : query.trim() && !isLoading ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">
                Try a different search term or ask the AI assistant
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
