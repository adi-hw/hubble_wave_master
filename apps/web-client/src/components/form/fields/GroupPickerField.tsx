import React, { useState, useEffect, useRef } from 'react';
import { FieldComponentProps } from '../types';
import { FieldWrapper, getInputClasses } from './FieldWrapper';
import { Users, Search, X, Loader2 } from 'lucide-react';
import { createApiClient } from '../../../services/api';

const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const identityApi = createApiClient(IDENTITY_API_URL);

interface Group {
  id: string;
  name: string;
  description?: string;
}

export const GroupPickerField: React.FC<FieldComponentProps<unknown>> = ({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}) => {
  // Convert value to string
  const strValue = value == null ? '' : typeof value === 'string' ? value : String(value);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch groups
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    identityApi
      .get('/groups', { params: { search, limit: 20 } })
      .then((res) => {
        setGroups(res.data.items || res.data || []);
      })
      .catch(() => {
        setGroups([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, search]);

  // Fetch selected group details
  useEffect(() => {
    if (strValue && !selectedGroup) {
      identityApi
        .get(`/groups/${strValue}`)
        .then((res) => setSelectedGroup(res.data))
        .catch(() => {});
    }
  }, [strValue, selectedGroup]);

  // Focus trap for dropdown
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (group: Group) => {
    setSelectedGroup(group);
    onChange(group.id);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    setSelectedGroup(null);
    onChange('');
  };

  if (readOnly) {
    return (
      <FieldWrapper label={field.label} required={false}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {selectedGroup?.name || strValue || '—'}
          </span>
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper
      label={field.label}
      required={field.config?.validators?.required}
      error={error}
      helpText={field.config?.helpText}
    >
      <div className="relative">
        {/* Selected group display */}
        {selectedGroup ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card min-h-[44px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {selectedGroup.name}
              </span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear selected group"
                className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            aria-label="Select a group"
            className={`${getInputClasses({ error, disabled })} w-full text-left flex items-center gap-2 min-h-[44px]`}
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Select a group...</span>
          </button>
        )}

        {/* Dropdown */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              ref={dropdownRef}
              role="dialog"
              aria-label="Group selection dialog"
              className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg shadow-xl max-h-72 overflow-hidden bg-card border border-border"
            >
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups..."
                    aria-label="Search groups"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>

              {/* Results */}
              <div role="listbox" aria-label="Available groups" className="max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : groups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No groups found
                  </div>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      role="option"
                      aria-selected={selectedGroup?.id === group.id}
                      onClick={() => handleSelect(group)}
                      className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted min-h-[44px]"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">
                          {group.name}
                        </p>
                        {group.description && (
                          <p className="text-xs truncate text-muted-foreground">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  );
};
