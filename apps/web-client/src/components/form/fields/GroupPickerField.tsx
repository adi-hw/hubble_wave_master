import React, { useState, useEffect } from 'react';
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
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-700">
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
          <div className="flex items-center justify-between px-3 py-2.5 border border-slate-300 rounded-lg bg-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">{selectedGroup.name}</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600"
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
            className={`${getInputClasses({ error, disabled })} w-full text-left flex items-center gap-2`}
          >
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">Select a group...</span>
          </button>
        )}

        {/* Dropdown */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : groups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No groups found
                  </div>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleSelect(group)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-700">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-slate-500 truncate">{group.description}</p>
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
