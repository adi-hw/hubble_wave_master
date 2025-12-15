import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Search, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { getInputClasses } from '../form/fields/FieldWrapper';

interface MultiReferenceSelectorProps {
  value?: string[]; // Array of IDs
  onChange: (value: string[]) => void;
  required?: boolean;
  referenceTable: string;
  disabled?: boolean;
  error?: boolean;
}

export const MultiReferenceSelector: React.FC<MultiReferenceSelectorProps> = ({
  value = [],
  onChange,
  referenceTable,
  disabled = false,
  error,
}) => {
  const { token } = useAuth();
  const [records, setRecords] = useState<any[]>([]); // Search results
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]); // Full record objects for selected IDs
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch full details for initial values
  useEffect(() => {
    const fetchInitialRecords = async () => {
      const idsToFetch = value.filter(id => !selectedRecords.find(r => r.id === id));
      if (idsToFetch.length === 0) return;

      setInitialLoading(true);
      try {
        // We need an endpoint to fetch multiple by IDs or loop. 
        // For now, loop (inefficient but works) or assume an API like /api/data/{table}?ids=1,2,3 exists.
        // Or simpler: fetch individual items.
        // Optimization: Use Promise.all
        const newRecords = await Promise.all(idsToFetch.map(async (id) => {
             const res = await fetch(`/api/data/${referenceTable}/${id}`, {
                 headers: { Authorization: `Bearer ${token}` },
             });
             return res.ok ? res.json() : null;
        }));
        
        setSelectedRecords(prev => [...prev, ...newRecords.filter(Boolean)]);
      } catch (err) {
        console.error('Failed to fetch initial records', err);
      } finally {
        setInitialLoading(false);
      }
    };

    if (value.length > 0) {
        fetchInitialRecords();
    }
  }, [value, referenceTable, token]);

  // Sync selectedRecords with value prop in case value changes externally (e.g. form reset)
  // This is a bit tricky to avoid infinite loops, simplistic approach:
  useEffect(() => {
     // If value has IDs not in selectedRecords, we fetch. (Handled above)
     // If selectedRecords has IDs not in value, we remove them.
     if (selectedRecords.some(r => !value.includes(r.id))) {
         setSelectedRecords(prev => prev.filter(r => value.includes(r.id)));
     }
  }, [value]);


  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayValue = (record: any) => {
    if (!record) return '';
    return record.attributes?.name || record.attributes?.title || record.attributes?.label || record.id;
  };

  const searchRecords = async (query: string) => {
    if (!query) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/data/${referenceTable}?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRecords(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.error('Failed to search records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search && isOpen) searchRecords(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, isOpen, token, referenceTable]);

  const handleSelect = (record: any) => {
    if (value.includes(record.id)) return;
    
    onChange([...value, record.id]);
    setSelectedRecords(prev => [...prev, record]);
    setSearch('');
    setRecords([]);
    // Keep input focused to allow selecting more
    inputRef.current?.focus();
  };

  const handleRemove = (idToRemove: string) => {
    onChange(value.filter(id => id !== idToRemove));
    setSelectedRecords(prev => prev.filter(r => r.id !== idToRemove));
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className={`${getInputClasses({ error: error ? 'true' : undefined, disabled, readOnly: false })} flex flex-wrap gap-1.5 min-h-[42px] py-1.5`}
        onClick={() => {
            if (!disabled) {
                setIsOpen(true);
                inputRef.current?.focus();
            }
        }}
      >
        {selectedRecords.map(record => (
            <span 
                key={record.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-primary-100 text-primary-800 border border-primary-200"
            >
                {getDisplayValue(record)}
                {!disabled && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(record.id);
                        }}
                        className="ml-1 text-primary-600 hover:text-primary-800 focus:outline-none"
                    >
                        <X size={14} />
                    </button>
                )}
            </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm p-0.5"
          placeholder={selectedRecords.length === 0 ? (initialLoading ? 'Loading...' : `Search ${referenceTable}...`) : ''}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled || initialLoading}
        />
        
        <div className="flex items-center gap-1 pr-1">
             {loading || initialLoading ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            ) : (
                <Search className="h-4 w-4 text-slate-400" />
            )}
        </div>
      </div>

      {isOpen && (search || records.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto">
          {records.length === 0 && search && !loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              test No results found
            </div>
          ) : (
            <ul className="py-1">
              {records.map((record) => {
                const isSelected = value.includes(record.id);
                return (
                    <li
                    key={record.id}
                    className={`
                        px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                        hover:bg-slate-50 transition-colors
                        ${isSelected ? 'bg-slate-50 opacity-50 cursor-default' : 'text-slate-700'}
                    `}
                    onClick={() => !isSelected && handleSelect(record)}
                    >
                    <div className="flex flex-col">
                        <span className="font-medium">{getDisplayValue(record)}</span>
                        {record.attributes?.description && (
                        <span className="text-xs text-slate-500 truncate max-w-[200px]">
                            {record.attributes.description}
                        </span>
                        )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary-600" />}
                    </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
