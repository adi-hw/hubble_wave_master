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

// Field type icons
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

// Operators based on field type
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

// Check if operator needs value input
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

// Check if operator needs two values (between)
const operatorNeedsTwoValues = (operator: string) => {
  return operator === 'between';
};

// Saved filters storage key
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

  // Load saved filters from localStorage
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

  // Prevent body scroll when drawer is open
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

  // Escape key to close
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

  const getFieldType = useCallback(
    (fieldCode: string) => {
      const field = fields.find((f) => f.code === fieldCode);
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
      // Reset value if operator doesn't need it
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

  // Save filter
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

  // Load filter
  const loadFilter = (filter: SavedFilter) => {
    setLocalRules(filter.rules);
    setShowLoadDialog(false);
  };

  // Delete saved filter
  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
  };

  const activeCount = rules.length;

  // Filter fields by search
  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      f.code.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const renderValueInput = (rule: FilterRule, index: number) => {
    const fieldType = getFieldType(rule.field);
    const needsValue = operatorNeedsValue(rule.operator);
    const needsTwoValues = operatorNeedsTwoValues(rule.operator);

    if (!needsValue) {
      return (
        <div className="h-12 flex items-center px-4 bg-slate-100 rounded-xl text-sm text-slate-500 italic">
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
            className="flex-1 h-12 px-4 text-base border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
          <span className="text-sm text-slate-400 font-medium">to</span>
          <input
            type={inputType}
            value={rule.value2 || ''}
            onChange={(e) => updateRule(index, { value2: e.target.value })}
            placeholder="To"
            className="flex-1 h-12 px-4 text-base border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
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
        className="w-full h-12 px-4 text-base border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
      />
    );
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          inline-flex items-center justify-center transition-all relative
          ${iconOnly
            ? `h-8 w-8 rounded-md ${activeCount ? 'text-primary-600 bg-primary-50' : 'text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'}`
            : `gap-2 h-9 px-3 rounded-lg border text-sm font-medium ${
                activeCount
                  ? 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`
          }
        `}
        title="Filter"
      >
        <Filter className="h-4 w-4" />
        {!iconOnly && <span className="hidden sm:inline">Filter</span>}
        {activeCount > 0 && (
          <span className={`
            inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-xs font-semibold
            ${iconOnly ? 'absolute -top-1 -right-1 h-4 min-w-[16px] px-1' : 'h-5 min-w-[20px] px-1.5'}
          `}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Full-screen Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
            onClick={cancel}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Filter Records</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Add conditions to filter your data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancel}
                  className="h-10 w-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoadDialog(true)}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Load Saved
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={localRules.length === 0}
                  className="h-9 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="h-9 px-4 text-sm font-medium text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {localRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Filter className="h-10 w-10 text-slate-400" />
                  </div>
                  <p className="text-lg font-medium text-slate-700">No filters applied</p>
                  <p className="text-sm text-slate-500 mt-1 mb-6">
                    Click the button below to add your first filter condition
                  </p>
                  <button
                    type="button"
                    onClick={addRule}
                    className="h-12 px-6 flex items-center gap-2 text-base font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    Add First Condition
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {localRules.map((rule, idx) => {
                    const FieldIcon = getFieldIcon(getFieldType(rule.field));
                    const operators = getOperatorsForType(getFieldType(rule.field));
                    const selectedField = fields.find((f) => f.code === rule.field);

                    return (
                      <div
                        key={idx}
                        className="relative bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors"
                      >
                        {/* Logical Operator Badge */}
                        {idx > 0 && (
                          <div className="absolute -top-3.5 left-6">
                            <select
                              value={rule.logicalOp || 'AND'}
                              onChange={(e) =>
                                updateRule(idx, {
                                  logicalOp: e.target.value as FilterRule['logicalOp'],
                                })
                              }
                              className="h-7 px-3 text-xs font-bold rounded-full border-2 border-primary-200 bg-primary-50 text-primary-700 cursor-pointer focus:ring-2 focus:ring-primary-300 focus:outline-none uppercase tracking-wide"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}

                        {/* Rule Actions - Top Right */}
                        <div className="absolute top-3 right-3 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRule(idx)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
                            title="Duplicate condition"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                            title="Remove condition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Rule Content */}
                        <div className="space-y-4 pr-20">
                          {/* Field Selection */}
                          <div className="relative">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Field
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveFieldDropdown(activeFieldDropdown === idx ? null : idx)
                              }
                              className="w-full h-12 px-4 flex items-center justify-between text-base border-2 border-slate-200 rounded-xl bg-white text-left hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <FieldIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
                                <span
                                  className={selectedField ? 'text-slate-900' : 'text-slate-400'}
                                >
                                  {selectedField?.label || 'Select a field...'}
                                </span>
                              </div>
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            </button>

                            {/* Field Dropdown */}
                            {activeFieldDropdown === idx && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-elevated z-50 overflow-hidden">
                                <div className="p-3 border-b border-slate-100">
                                  <input
                                    type="text"
                                    value={fieldSearch}
                                    onChange={(e) => setFieldSearch(e.target.value)}
                                    placeholder="Search fields..."
                                    className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg bg-slate-50 placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-1 focus:ring-primary-100 focus:outline-none"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-64 overflow-y-auto p-2">
                                  {filteredFields.length === 0 ? (
                                    <div className="px-4 py-6 text-sm text-slate-500 text-center">
                                      No fields found
                                    </div>
                                  ) : (
                                    filteredFields.map((field) => {
                                      const Icon = getFieldIcon(field.type);
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
                                          className={`
                                            w-full flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors text-left
                                            ${
                                              rule.field === field.code
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-slate-700 hover:bg-slate-50'
                                            }
                                          `}
                                        >
                                          <Icon className="h-5 w-5 text-slate-400" />
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{field.label}</div>
                                            <div className="text-sm text-slate-400 truncate">
                                              {field.code}
                                            </div>
                                          </div>
                                          {rule.field === field.code && (
                                            <Check className="h-5 w-5 text-primary-600" />
                                          )}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Operator Selection */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Condition
                            </label>
                            <select
                              value={rule.operator}
                              onChange={(e) => updateRule(idx, { operator: e.target.value })}
                              className="w-full h-12 px-4 text-base border-2 border-slate-200 rounded-xl bg-white text-slate-800 cursor-pointer focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                            >
                              {operators.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.icon ? `${op.icon} ` : ''}
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Value Input */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Value
                            </label>
                            {renderValueInput(rule, idx)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Condition Button */}
                  <button
                    type="button"
                    onClick={addRule}
                    className="w-full h-14 flex items-center justify-center gap-3 text-base font-medium text-primary-600 border-2 border-dashed border-primary-200 rounded-xl hover:bg-primary-50 hover:border-primary-300 transition-all"
                  >
                    <Plus className="h-5 w-5" />
                    Add Another Condition
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {localRules.length} condition{localRules.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  className="h-11 px-6 text-base font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="h-11 px-8 text-base font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Save Filter Dialog */}
            {showSaveDialog && (
              <div className="absolute inset-0 bg-white/98 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-50">
                <div className="w-full max-w-md">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                    <Save className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 text-center mb-2">
                    Save Filter
                  </h3>
                  <p className="text-sm text-slate-500 text-center mb-6">
                    Give your filter a name to save it for quick access later
                  </p>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Filter name..."
                    className="w-full h-12 px-4 text-base border-2 border-slate-200 rounded-xl bg-white placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none mb-6"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveFilter();
                      if (e.key === 'Escape') setShowSaveDialog(false);
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSaveDialog(false)}
                      className="flex-1 h-11 text-base font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveFilter}
                      disabled={!filterName.trim()}
                      className="flex-1 h-11 text-base font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Save Filter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Load Filter Dialog */}
            {showLoadDialog && (
              <div className="absolute inset-0 bg-white/98 backdrop-blur-sm flex flex-col p-6 z-50">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Saved Filters</h3>
                    <p className="text-sm text-slate-500 mt-1">Select a filter to apply</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLoadDialog(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {savedFilters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <AlertCircle className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-700">No saved filters</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Save your frequently used filters for quick access
                      </p>
                    </div>
                  ) : (
                    savedFilters.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => loadFilter(filter)}
                          className="flex-1 text-left flex items-center gap-4"
                        >
                          <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Filter className="h-6 w-6 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-base font-medium text-slate-900">
                              {filter.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {filter.rules.length} condition
                              {filter.rules.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedFilter(filter.id)}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors ml-3"
                          title="Delete"
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

      {/* CSS for animations */}
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
