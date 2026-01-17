import React, { useState, useCallback, useMemo } from 'react';
import {
  Filter,
  Plus,
  X,
  Trash2,
  Copy,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  Clock,
  AlertCircle,
  Check,
} from 'lucide-react';
import { FilterRule, generateFilterId } from './types';

interface InlineFilterPanelProps {
  fields: { code: string; label: string; type?: string }[];
  rules: FilterRule[];
  onChange: (next: FilterRule[]) => void;
  onClear: () => void;
  onClose: () => void;
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

export const InlineFilterPanel: React.FC<InlineFilterPanelProps> = ({
  fields,
  rules,
  onChange,
  onClear,
  onClose,
}) => {
  const [localRules, setLocalRules] = useState<FilterRule[]>(rules);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_FILTERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [fieldSearch, setFieldSearch] = useState('');
  const [activeFieldDropdown, setActiveFieldDropdown] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  React.useEffect(() => {
    setLocalRules(rules);
  }, [rules]);

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
  };

  const cancel = () => {
    setLocalRules(rules);
    onClose();
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

  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      f.code.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const hasChanges = useMemo(() => {
    return JSON.stringify(localRules) !== JSON.stringify(rules);
  }, [localRules, rules]);

  const renderValueInput = (rule: FilterRule, index: number) => {
    const fieldType = getPropertyType(rule.field);
    const needsValue = operatorNeedsValue(rule.operator);
    const needsTwoValues = operatorNeedsTwoValues(rule.operator);

    if (!needsValue) {
      return (
        <div className="h-9 flex items-center px-3 rounded-lg text-sm italic bg-muted text-muted-foreground">
          No value needed
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
        <div className="flex items-center gap-2">
          <input
            type={inputType}
            value={rule.value || ''}
            onChange={(e) => updateRule(index, { value: e.target.value })}
            placeholder="From"
            className="input flex-1 h-9 text-sm"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type={inputType}
            value={rule.value2 || ''}
            onChange={(e) => updateRule(index, { value2: e.target.value })}
            placeholder="To"
            className="input flex-1 h-9 text-sm"
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
        className="input w-full h-9 text-sm"
      />
    );
  };

  return (
    <div className="overflow-hidden transition-all duration-300 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10">
            <Filter className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Filter Records
            </h3>
            <p className="text-xs text-muted-foreground">
              {localRules.length} condition{localRules.length !== 1 ? 's' : ''}
              {hasChanges && <span className="ml-1 text-warning-text">(unsaved)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLoadDialog(true)}
            className="h-7 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 text-muted-foreground bg-muted hover:bg-muted/80"
            title="Load saved filter"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Load</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            disabled={localRules.length === 0}
            className="h-7 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-40 text-muted-foreground bg-muted hover:bg-muted/80"
            title="Save filter"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={() => {
              clearAll();
              onClear();
            }}
            disabled={localRules.length === 0}
            className="h-7 px-2.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-40 text-destructive bg-destructive/10 hover:bg-destructive/20"
            title="Clear all filters"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 flex items-center justify-center rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={cancel}
            className="h-7 w-7 flex items-center justify-center rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="px-4 py-3 max-h-[300px] overflow-y-auto">
            {localRules.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-primary bg-primary/10 hover:bg-primary/20"
                >
                  <Plus className="h-4 w-4" />
                  Add First Condition
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {localRules.map((rule, idx) => {
                  const FieldIcon = getFieldIcon(getPropertyType(rule.field));
                  const operators = getOperatorsForType(getPropertyType(rule.field));
                  const selectedField = fields.find((f) => f.code === rule.field);

                  return (
                    <div
                      key={idx}
                      className="relative rounded-xl p-3 transition-colors bg-muted border border-border/50"
                    >
                      {idx > 0 && (
                        <div className="absolute -top-2.5 left-4">
                          <select
                            value={rule.logicalOp || 'AND'}
                            onChange={(e) =>
                              updateRule(idx, {
                                logicalOp: e.target.value as FilterRule['logicalOp'],
                              })
                            }
                            className="h-5 px-2 text-[10px] font-bold rounded-full cursor-pointer focus:ring-1 focus:outline-none uppercase tracking-wide bg-primary/10 text-primary border border-primary"
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="relative flex-1 min-w-0">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
                            Field
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFieldDropdown(activeFieldDropdown === idx ? null : idx)
                            }
                            className={`w-full h-9 px-3 flex items-center justify-between text-sm rounded-lg transition-colors bg-card border border-border ${selectedField ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 truncate">
                              <FieldIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="truncate">
                                {selectedField?.label || 'Select field...'}
                              </span>
                            </div>
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          </button>

                          {activeFieldDropdown === idx && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50 overflow-hidden bg-card border border-border">
                              <div className="p-2 border-b border-border/50">
                                <input
                                  type="text"
                                  value={fieldSearch}
                                  onChange={(e) => setFieldSearch(e.target.value)}
                                  placeholder="Search fields..."
                                  className="input w-full h-8 text-sm"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto p-1">
                                {filteredFields.length === 0 ? (
                                  <div className="px-3 py-4 text-sm text-center text-muted-foreground">
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
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                                      >
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                        <span className="flex-1 text-left truncate">{field.label}</span>
                                        {isSelected && <Check className="h-4 w-4" />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="w-40 flex-shrink-0">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
                            Condition
                          </label>
                          <select
                            value={rule.operator}
                            onChange={(e) => updateRule(idx, { operator: e.target.value })}
                            className="input w-full h-9 text-sm cursor-pointer"
                          >
                            {operators.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.icon ? `${op.icon} ` : ''}
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
                            Value
                          </label>
                          {renderValueInput(rule, idx)}
                        </div>

                        <div className="flex items-end gap-1 pb-0.5">
                          <button
                            type="button"
                            onClick={() => duplicateRule(idx)}
                            className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRule(idx)}
                            className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors text-destructive hover:bg-destructive/10"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addRule}
                  className="w-full h-10 flex items-center justify-center gap-2 text-sm font-medium rounded-lg border-2 border-dashed transition-colors text-primary border-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  Add Condition
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 bg-muted border-t border-border">
            <span className="text-xs text-muted-foreground">
              {localRules.length} condition{localRules.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancel}
                className="btn btn-secondary h-8 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!hasChanges}
                className="btn btn-primary h-8 text-sm flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {showSaveDialog && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-card">
          <div className="w-full max-w-sm p-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10">
              <Save className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-center mb-2 text-foreground">
              Save Filter
            </h3>
            <p className="text-sm text-center mb-4 text-muted-foreground">
              Give your filter a name for quick access later
            </p>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter name..."
              className="input w-full h-10 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveFilter();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveFilter}
                disabled={!filterName.trim()}
                className="btn btn-primary flex-1"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadDialog && (
        <div className="absolute inset-0 flex flex-col z-50 bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-base font-semibold text-foreground">Saved Filters</h3>
              <p className="text-xs text-muted-foreground">Select a filter to apply</p>
            </div>
            <button
              type="button"
              onClick={() => setShowLoadDialog(false)}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {savedFilters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-muted">
                  <AlertCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No saved filters</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Save your filters for quick access
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer bg-muted border border-border/50 hover:bg-muted/80"
                    onClick={() => loadFilter(filter)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
                        <Filter className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {filter.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {filter.rules.length} condition{filter.rules.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedFilter(filter.id);
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
