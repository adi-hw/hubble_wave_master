import React, { useEffect, useState, useCallback } from 'react';
import {
  Filter,
  Plus,
  X,
  Trash2,
  Copy,
  Save,
  FolderOpen,
  ChevronDown,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  Clock,
  AlertCircle,
  Check,
} from 'lucide-react';
import { FilterRule, generateFilterId } from './types';

interface FilterPopoverProps {
  fields: { code: string; label: string; type?: string }[];
  rules: FilterRule[];
  onChange: (next: FilterRule[]) => void;
  onClear: () => void;
  iconOnly?: boolean;
}

const getFieldIcon = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'decimal':
      return Hash;
    case 'boolean':
      return ToggleLeft;
    case 'date':
      return Calendar;
    case 'datetime':
    case 'timestamp':
      return Clock;
    default:
      return Type;
  }
};

const getOperatorsForType = (type?: string) => {
  const baseOperators = [
    { value: 'equals', label: 'equals', icon: '=' },
    { value: 'not_equals', label: 'does not equal', icon: '!=' },
    { value: 'is_empty', label: 'is empty', icon: '' },
    { value: 'is_not_empty', label: 'is not empty', icon: '' },
  ];

  const textOperators = [
    { value: 'contains', label: 'contains', icon: '' },
    { value: 'not_contains', label: 'does not contain', icon: '' },
    { value: 'starts_with', label: 'starts with', icon: '' },
    { value: 'ends_with', label: 'ends with', icon: '' },
    { value: 'matches_regex', label: 'matches pattern', icon: '' },
  ];

  const numberOperators = [
    { value: 'greater_than', label: 'greater than', icon: '>' },
    { value: 'less_than', label: 'less than', icon: '<' },
    { value: 'greater_or_equal', label: 'greater or equal', icon: '>=' },
    { value: 'less_or_equal', label: 'less or equal', icon: '<=' },
    { value: 'between', label: 'between', icon: '' },
  ];

  const dateOperators = [
    { value: 'before', label: 'before', icon: '<' },
    { value: 'after', label: 'after', icon: '>' },
    { value: 'on_or_before', label: 'on or before', icon: '<=' },
    { value: 'on_or_after', label: 'on or after', icon: '>=' },
    { value: 'between', label: 'between', icon: '' },
    { value: 'today', label: 'is today', icon: '' },
    { value: 'this_week', label: 'this week', icon: '' },
    { value: 'this_month', label: 'this month', icon: '' },
    { value: 'last_7_days', label: 'last 7 days', icon: '' },
    { value: 'last_30_days', label: 'last 30 days', icon: '' },
  ];

  const booleanOperators = [
    { value: 'is_true', label: 'is true', icon: '' },
    { value: 'is_false', label: 'is false', icon: '' },
  ];

  switch (type?.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'decimal':
      return [...baseOperators, ...numberOperators];
    case 'date':
    case 'datetime':
    case 'timestamp':
      return [...baseOperators, ...dateOperators];
    case 'boolean':
      return booleanOperators;
    default:
      return [...baseOperators, ...textOperators];
  }
};

const operatorNeedsValue = (operator: string) => {
  return ![
    'is_empty',
    'is_not_empty',
    'is_true',
    'is_false',
    'today',
    'this_week',
    'this_month',
    'last_7_days',
    'last_30_days',
  ].includes(operator);
};

const operatorNeedsTwoValues = (operator: string) => {
  return operator === 'between';
};

const SAVED_FILTERS_KEY = 'eam_saved_filters';

interface SavedFilter {
  id: string;
  name: string;
  rules: FilterRule[];
  createdAt: string;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  fields,
  rules,
  onChange,
  onClear,
  iconOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [localRules, setLocalRules] = useState<FilterRule[]>(rules);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [activeFieldDropdown, setActiveFieldDropdown] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_FILTERS_KEY);
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFieldDropdown(null);
        if (!showSaveDialog && !showLoadDialog) {
          setOpen(false);
        } else {
          setShowSaveDialog(false);
          setShowLoadDialog(false);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, showSaveDialog, showLoadDialog]);

  const getPropertyType = useCallback(
    (propertyCode: string) => {
      const field = fields.find((f) => f.code === propertyCode);
      return field?.type;
    },
    [fields]
  );

  const addRule = () => {
    setLocalRules((prev) => [
      ...prev,
      {
        id: generateFilterId(),
        field: '',
        operator: 'contains',
        value: '',
        value2: '',
        logicalOp: prev.length === 0 ? 'AND' : 'AND',
      },
    ]);
  };

  const duplicateRule = (index: number) => {
    setLocalRules((prev) => {
      const rule = prev[index];
      return [...prev.slice(0, index + 1), { ...rule, id: generateFilterId() }, ...prev.slice(index + 1)];
    });
  };

  const updateRule = (index: number, patch: Partial<FilterRule>) => {
    setLocalRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (patch.operator && !operatorNeedsValue(patch.operator)) {
        next[index].value = '';
        next[index].value2 = '';
      }
      return next;
    });
  };

  const removeRule = (index: number) => {
    setLocalRules((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setLocalRules([]);
  };

  const apply = () => {
    const cleaned = localRules
      .map((r, idx) => ({
        ...r,
        logicalOp: idx === 0 ? 'AND' : r.logicalOp || 'AND',
      }))
      .filter((r) => {
        if (!r.field) return false;
        if (operatorNeedsValue(r.operator) && String(r.value).trim() === '') return false;
        return true;
      });
    onChange(cleaned as FilterRule[]);
    setOpen(false);
  };

  const cancel = () => {
    setLocalRules(rules);
    setOpen(false);
  };

  const saveFilter = () => {
    if (!filterName.trim() || localRules.length === 0) return;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      rules: localRules,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    setFilterName('');
    setShowSaveDialog(false);
  };

  const loadFilter = (filter: SavedFilter) => {
    setLocalRules(filter.rules);
    setShowLoadDialog(false);
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
  };

  const activeCount = rules.length;

  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      f.code.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const renderValueInput = (rule: FilterRule, index: number) => {
    const fieldType = getPropertyType(rule.field);
    const needsValue = operatorNeedsValue(rule.operator);
    const needsTwoValues = operatorNeedsTwoValues(rule.operator);

    if (!needsValue) {
      return (
        <div className="h-12 flex items-center px-4 rounded-xl text-sm italic bg-muted text-muted-foreground">
          No value needed for this condition
        </div>
      );
    }

    const inputType =
      fieldType === 'number' || fieldType === 'integer' || fieldType === 'decimal'
        ? 'number'
        : fieldType === 'date'
          ? 'date'
          : fieldType === 'datetime'
            ? 'datetime-local'
            : 'text';

    if (needsTwoValues) {
      return (
        <div className="flex items-center gap-3">
          <input
            type={inputType}
            value={rule.value || ''}
            onChange={(e) => updateRule(index, { value: e.target.value })}
            placeholder="From"
            className="flex-1 h-12 px-4 text-base border rounded-xl focus:outline-none bg-card text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-sm font-medium text-muted-foreground">to</span>
          <input
            type={inputType}
            value={rule.value2 || ''}
            onChange={(e) => updateRule(index, { value2: e.target.value })}
            placeholder="To"
            className="flex-1 h-12 px-4 text-base border rounded-xl focus:outline-none bg-card text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      );
    }

    return (
      <input
        type={inputType}
        value={rule.value || ''}
        onChange={(e) => updateRule(index, { value: e.target.value })}
        placeholder="Enter value..."
        className="w-full h-12 px-4 text-base border rounded-xl focus:outline-none bg-card text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center transition-all relative ${
          iconOnly
            ? `h-8 w-8 rounded-md ${
                activeCount
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card hover:shadow-sm'
              }`
            : `gap-2 h-9 px-3 rounded-lg border text-sm font-medium ${
                activeCount
                  ? 'bg-primary/10 border-primary text-primary hover:bg-primary/15'
                  : 'bg-card border-border text-foreground hover:bg-muted hover:border-muted-foreground/30'
              }`
        }`}
        title="Filter"
        aria-label="Open filter panel"
        aria-expanded={open}
      >
        <Filter className="h-4 w-4" />
        {!iconOnly && <span className="hidden sm:inline">Filter</span>}
        {activeCount > 0 && (
          <span
            className={`inline-flex items-center justify-center rounded-full text-xs font-semibold bg-primary text-primary-foreground ${iconOnly ? 'absolute -top-1 -right-1 h-4 min-w-[16px] px-1' : 'h-5 min-w-[20px] px-1.5'}`}
            aria-label={`${activeCount} active filter${activeCount !== 1 ? 's' : ''}`}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 backdrop-blur-sm animate-fade-in bg-overlay/50"
            onClick={cancel}
            aria-hidden="true"
          />

          <div
            className="relative w-full max-w-2xl shadow-2xl flex flex-col animate-slide-in-right bg-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-dialog-title"
            aria-describedby="filter-dialog-description"
          >
            <div className="flex-shrink-0 px-6 py-5 border-b border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="filter-dialog-title" className="text-xl font-semibold text-foreground">
                    Filter Records
                  </h2>
                  <p id="filter-dialog-description" className="text-sm mt-1 text-muted-foreground">
                    Add conditions to filter your data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancel}
                  className="h-10 w-10 flex items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Close filter panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoadDialog(true)}
                  className="h-9 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 text-foreground bg-muted hover:bg-muted/80"
                >
                  <FolderOpen className="h-4 w-4" />
                  Load Saved
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={localRules.length === 0}
                  className="h-9 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-foreground bg-muted hover:bg-muted/80"
                >
                  <Save className="h-4 w-4" />
                  Save Filter
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    clearAll();
                    onClear();
                  }}
                  className="h-9 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 text-destructive bg-destructive/10 hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {localRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-muted">
                    <Filter className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    No filters applied
                  </p>
                  <p className="text-sm mt-1 mb-6 text-muted-foreground">
                    Click the button below to add your first filter condition
                  </p>
                  <button
                    type="button"
                    onClick={addRule}
                    className="h-12 px-6 flex items-center gap-2 text-base font-medium rounded-xl shadow-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-5 w-5" />
                    Add First Condition
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {localRules.map((rule, idx) => {
                    const FieldIcon = getFieldIcon(getPropertyType(rule.field));
                    const operators = getOperatorsForType(getPropertyType(rule.field));
                    const selectedField = fields.find((f) => f.code === rule.field);

                    return (
                      <div
                        key={idx}
                        className="relative border-2 rounded-2xl p-5 transition-colors bg-muted border-border hover:border-muted-foreground/30"
                      >
                        {idx > 0 && (
                          <div className="absolute -top-3.5 left-6">
                            <select
                              value={rule.logicalOp || 'AND'}
                              onChange={(e) =>
                                updateRule(idx, {
                                  logicalOp: e.target.value as FilterRule['logicalOp'],
                                })
                              }
                              className="h-7 px-3 text-xs font-bold rounded-full border-2 cursor-pointer focus:outline-none uppercase tracking-wide border-primary bg-primary/10 text-primary focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}

                        <div className="absolute top-3 right-3 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRule(idx)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-card"
                            title="Duplicate condition"
                            aria-label="Duplicate condition"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove condition"
                            aria-label="Remove condition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-4 pr-20">
                          <div className="relative">
                            <label className="block text-sm font-semibold mb-2 text-foreground">
                              Field
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveFieldDropdown(activeFieldDropdown === idx ? null : idx)
                              }
                              className="w-full h-12 px-4 flex items-center justify-between text-base border-2 rounded-xl text-left transition-colors border-border bg-card hover:border-muted-foreground/30"
                              aria-expanded={activeFieldDropdown === idx}
                              aria-haspopup="listbox"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <FieldIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                <span className={selectedField ? 'text-foreground' : 'text-muted-foreground'}>
                                  {selectedField?.label || 'Select a field...'}
                                </span>
                              </div>
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </button>

                            {activeFieldDropdown === idx && (
                              <div
                                className="absolute top-full left-0 right-0 mt-2 border-2 rounded-xl shadow-lg z-50 overflow-hidden bg-card border-border"
                                role="listbox"
                                aria-label="Field selection"
                              >
                                <div className="p-3 border-b border-border">
                                  <input
                                    type="text"
                                    value={fieldSearch}
                                    onChange={(e) => setFieldSearch(e.target.value)}
                                    placeholder="Search fields..."
                                    className="w-full h-10 px-4 text-sm border rounded-lg focus:outline-none bg-muted border-border text-foreground focus:border-primary focus:bg-card focus:ring-1 focus:ring-primary/20"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-64 overflow-y-auto p-2">
                                  {filteredFields.length === 0 ? (
                                    <div className="px-4 py-6 text-sm text-center text-muted-foreground">
                                      No fields found
                                    </div>
                                  ) : (
                                    filteredFields.map((field) => {
                                      const Icon = getFieldIcon(field.type);
                                      const isSelected = rule.field === field.code;
                                      return (
                                        <button
                                          key={field.code}
                                          type="button"
                                          onClick={() => {
                                            updateRule(idx, {
                                              field: field.code,
                                              operator: getOperatorsForType(field.type)[0].value,
                                            });
                                            setActiveFieldDropdown(null);
                                            setFieldSearch('');
                                          }}
                                          className={`w-full flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors text-left ${
                                            isSelected
                                              ? 'bg-primary/10 text-primary'
                                              : 'text-foreground hover:bg-muted'
                                          }`}
                                          role="option"
                                          aria-selected={isSelected}
                                        >
                                          <Icon className="h-5 w-5 text-muted-foreground" />
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{field.label}</div>
                                            <div className="text-sm truncate text-muted-foreground">
                                              {field.code}
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <Check className="h-5 w-5 text-primary" />
                                          )}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-semibold mb-2 text-foreground">
                              Condition
                            </label>
                            <select
                              value={rule.operator}
                              onChange={(e) => updateRule(idx, { operator: e.target.value })}
                              className="w-full h-12 px-4 text-base border-2 rounded-xl cursor-pointer focus:outline-none border-border bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                            >
                              {operators.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.icon ? `${op.icon} ` : ''}
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold mb-2 text-foreground">
                              Value
                            </label>
                            {renderValueInput(rule, idx)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addRule}
                    className="w-full h-14 flex items-center justify-center gap-3 text-base font-medium border-2 border-dashed rounded-xl transition-all text-primary border-primary hover:bg-primary/10"
                  >
                    <Plus className="h-5 w-5" />
                    Add Another Condition
                  </button>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between border-border bg-muted">
              <div className="text-sm text-muted-foreground">
                {localRules.length} condition{localRules.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  className="h-11 px-6 text-base font-medium border rounded-xl transition-colors text-muted-foreground bg-card border-border hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="h-11 px-8 text-base font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-5 w-5" />
                  Apply Filters
                </button>
              </div>
            </div>

            {showSaveDialog && (
              <div
                className="absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-50 bg-card/98"
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-filter-title"
              >
                <div className="w-full max-w-md">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10">
                    <Save className="h-8 w-8 text-primary" />
                  </div>
                  <h3 id="save-filter-title" className="text-xl font-semibold text-center mb-2 text-foreground">
                    Save Filter
                  </h3>
                  <p className="text-sm text-center mb-6 text-muted-foreground">
                    Give your filter a name to save it for quick access later
                  </p>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Filter name..."
                    className="w-full h-12 px-4 text-base border-2 rounded-xl focus:outline-none mb-6 bg-card border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveFilter();
                      if (e.key === 'Escape') setShowSaveDialog(false);
                    }}
                    aria-label="Filter name"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSaveDialog(false)}
                      className="flex-1 h-11 text-base font-medium border rounded-xl transition-colors text-muted-foreground bg-card border-border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveFilter}
                      disabled={!filterName.trim()}
                      className="flex-1 h-11 text-base font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Save Filter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showLoadDialog && (
              <div
                className="absolute inset-0 backdrop-blur-sm flex flex-col p-6 z-50 bg-card/98"
                role="dialog"
                aria-modal="true"
                aria-labelledby="load-filter-title"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 id="load-filter-title" className="text-xl font-semibold text-foreground">
                      Saved Filters
                    </h3>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Select a filter to apply
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLoadDialog(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Close saved filters dialog"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {savedFilters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-muted">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium text-foreground">
                        No saved filters
                      </p>
                      <p className="text-sm mt-1 text-muted-foreground">
                        Save your frequently used filters for quick access
                      </p>
                    </div>
                  ) : (
                    savedFilters.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex items-center justify-between p-4 border-2 rounded-xl transition-all border-border hover:border-muted-foreground/30 hover:shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => loadFilter(filter)}
                          className="flex-1 text-left flex items-center gap-4"
                        >
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                            <Filter className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="text-base font-medium text-foreground">
                              {filter.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {filter.rules.length} condition
                              {filter.rules.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedFilter(filter.id)}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg transition-colors ml-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          aria-label={`Delete ${filter.name}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
