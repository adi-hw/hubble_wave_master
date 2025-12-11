import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Layers,
  Search,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Loader2,
} from 'lucide-react';
import { ModelField } from '../../../services/platform.service';
import { DesignerEmbeddedList } from './types';

interface RelatedTable {
  tableCode: string;
  tableName: string;
  referenceField: string; // Field on child table pointing to parent
  description?: string;
}

interface EmbeddedListConfigProps {
  /**
   * The parent table code
   */
  parentTableCode: string;

  /**
   * Available related tables that reference this table
   */
  relatedTables: RelatedTable[];

  /**
   * Function to fetch fields for a table
   */
  onFetchTableFields: (tableCode: string) => Promise<ModelField[]>;

  /**
   * Callback when configuration is complete
   */
  onSave: (config: DesignerEmbeddedList) => void;

  /**
   * Callback to close the configurator
   */
  onClose: () => void;

  /**
   * Existing configuration for editing (optional)
   */
  existingConfig?: DesignerEmbeddedList;
}

interface ColumnConfig {
  fieldCode: string;
  label: string;
  visible: boolean;
  width?: number;
}

export const EmbeddedListConfig: React.FC<EmbeddedListConfigProps> = ({
  parentTableCode,
  relatedTables,
  onFetchTableFields,
  onSave,
  onClose,
  existingConfig,
}) => {
  const [step, setStep] = useState<'table' | 'columns' | 'options'>(existingConfig ? 'columns' : 'table');
  const [selectedTable, setSelectedTable] = useState<RelatedTable | null>(
    existingConfig
      ? relatedTables.find((t) => t.tableCode === existingConfig.tableCode) || null
      : null
  );
  const [tableFields, setTableFields] = useState<ModelField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Column configuration
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [columnSearch, setColumnSearch] = useState('');

  // Options
  const [label, setLabel] = useState(existingConfig?.label || '');
  const [description, setDescription] = useState(existingConfig?.description || '');
  const [maxRows, setMaxRows] = useState(existingConfig?.maxRows || 10);
  const [allowCreate, setAllowCreate] = useState(existingConfig?.allowCreate ?? true);
  const [allowEdit, setAllowEdit] = useState(existingConfig?.allowEdit ?? true);
  const [allowDelete, setAllowDelete] = useState(existingConfig?.allowDelete ?? false);
  const [collapsible, setCollapsible] = useState(existingConfig?.collapsible ?? true);
  const [defaultCollapsed, setDefaultCollapsed] = useState(existingConfig?.defaultCollapsed ?? false);
  const [sortField, setSortField] = useState(existingConfig?.defaultSort?.field || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    existingConfig?.defaultSort?.direction || 'desc'
  );

  // Load fields when table is selected
  useEffect(() => {
    if (selectedTable) {
      loadTableFields(selectedTable.tableCode);
    }
  }, [selectedTable]);

  // Initialize columns from existing config
  useEffect(() => {
    if (existingConfig && tableFields.length > 0) {
      const existingColumns = existingConfig.columns.map((code) => {
        const field = tableFields.find((f) => f.code === code);
        return {
          fieldCode: code,
          label: field?.label || code,
          visible: true,
        };
      });
      setColumns(existingColumns);
    }
  }, [existingConfig, tableFields]);

  const loadTableFields = async (tableCode: string) => {
    setLoadingFields(true);
    try {
      const fields = await onFetchTableFields(tableCode);
      setTableFields(fields);

      // If no existing config, pre-select some common columns
      if (!existingConfig) {
        const defaultColumns = fields
          .filter((f) => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(f.code))
          .slice(0, 5)
          .map((f) => ({
            fieldCode: f.code,
            label: f.label,
            visible: true,
          }));
        setColumns(defaultColumns);
      }
    } catch (error) {
      console.error('Failed to load table fields:', error);
    } finally {
      setLoadingFields(false);
    }
  };

  // Filter tables by search
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return relatedTables;
    const term = tableSearch.toLowerCase();
    return relatedTables.filter(
      (t) =>
        t.tableName.toLowerCase().includes(term) ||
        t.tableCode.toLowerCase().includes(term)
    );
  }, [relatedTables, tableSearch]);

  // Filter available fields
  const availableFields = useMemo(() => {
    const selectedCodes = new Set(columns.map((c) => c.fieldCode));
    let available = tableFields.filter((f) => !selectedCodes.has(f.code));

    if (columnSearch.trim()) {
      const term = columnSearch.toLowerCase();
      available = available.filter(
        (f) =>
          f.label.toLowerCase().includes(term) ||
          f.code.toLowerCase().includes(term)
      );
    }

    return available;
  }, [tableFields, columns, columnSearch]);

  // Handle table selection
  const handleSelectTable = (table: RelatedTable) => {
    setSelectedTable(table);
    setLabel(table.tableName);
    setStep('columns');
  };

  // Handle add column
  const handleAddColumn = (field: ModelField) => {
    setColumns([
      ...columns,
      {
        fieldCode: field.code,
        label: field.label,
        visible: true,
      },
    ]);
  };

  // Handle remove column
  const handleRemoveColumn = (fieldCode: string) => {
    setColumns(columns.filter((c) => c.fieldCode !== fieldCode));
  };

  // Handle reorder columns
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    setColumns(newColumns);
  };

  // Handle save
  const handleSave = () => {
    if (!selectedTable || columns.length === 0) return;

    const config: DesignerEmbeddedList = {
      type: 'embedded_list',
      id: existingConfig?.id || `embedded-${Date.now()}`,
      label,
      description: description || undefined,
      tableCode: selectedTable.tableCode,
      referenceField: selectedTable.referenceField,
      columns: columns.filter((c) => c.visible).map((c) => c.fieldCode),
      defaultSort: sortField ? { field: sortField, direction: sortDirection } : undefined,
      maxRows,
      allowCreate,
      allowEdit,
      allowDelete,
      collapsible,
      defaultCollapsed,
      span: 4, // Full width by default
    };

    onSave(config);
  };

  // Validate current step
  const canProceed = () => {
    switch (step) {
      case 'table':
        return selectedTable !== null;
      case 'columns':
        return columns.filter((c) => c.visible).length > 0;
      case 'options':
        return label.trim().length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-[500px] max-h-[600px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Layers className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {existingConfig ? 'Edit Embedded List' : 'Add Embedded List'}
              </h3>
              <p className="text-[10px] text-slate-500">
                Display related records from another table
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mt-4">
          {(['table', 'columns', 'options'] as const).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className="flex-1 h-px bg-slate-200" />}
              <button
                onClick={() => s !== 'table' || !existingConfig ? null : setStep(s)}
                disabled={
                  (s === 'columns' && !selectedTable) ||
                  (s === 'options' && columns.length === 0)
                }
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  step === s
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === s
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                {s === 'table' ? 'Select Table' : s === 'columns' ? 'Columns' : 'Options'}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Step 1: Select Table */}
        {step === 'table' && (
          <div className="p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search related tables..."
                className="w-full h-8 pl-8 pr-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
            </div>

            {/* Table List */}
            <div className="space-y-2">
              {filteredTables.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Layers className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No related tables found</p>
                  <p className="text-xs mt-1">
                    Tables that reference {parentTableCode} will appear here
                  </p>
                </div>
              ) : (
                filteredTables.map((table) => (
                  <button
                    key={table.tableCode}
                    onClick={() => handleSelectTable(table)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      selectedTable?.tableCode === table.tableCode
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{table.tableName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {table.tableCode} • via {table.referenceField}
                      </p>
                      {table.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {table.description}
                        </p>
                      )}
                    </div>
                    {selectedTable?.tableCode === table.tableCode && (
                      <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Configure Columns */}
        {step === 'columns' && (
          <div className="p-4 space-y-4">
            {loadingFields ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <span className="text-sm">Loading fields...</span>
              </div>
            ) : (
              <>
                {/* Selected Columns */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Selected Columns ({columns.length})
                  </h4>
                  <div className="space-y-1 min-h-[100px] p-2 border border-dashed border-slate-200 rounded-lg">
                    {columns.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        Add columns from below
                      </div>
                    ) : (
                      columns.map((col, index) => (
                        <div
                          key={col.fieldCode}
                          className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg"
                        >
                          <GripVertical className="h-4 w-4 text-slate-300 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-700">
                              {col.label}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                              {col.fieldCode}
                            </span>
                          </div>
                          <button
                            onClick={() => handleMoveColumn(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveColumn(index, 'down')}
                            disabled={index === columns.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveColumn(col.fieldCode)}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Fields */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Available Fields
                  </h4>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full h-8 pl-8 pr-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="max-h-[150px] overflow-y-auto space-y-1">
                    {availableFields.map((field) => (
                      <button
                        key={field.code}
                        onClick={() => handleAddColumn(field)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <Plus className="h-4 w-4 text-primary-600" />
                        <span className="text-sm font-medium text-slate-700">
                          {field.label}
                        </span>
                        <span className="text-xs text-slate-400">{field.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Options */}
        {step === 'options' && (
          <div className="p-4 space-y-4">
            {/* Label */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Display Label *
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
            </div>

            {/* Default Sort */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Default Sort
                </label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
                >
                  <option value="">None</option>
                  {tableFields.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Direction
                </label>
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  disabled={!sortField}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors disabled:opacity-50"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            {/* Max Rows */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Max Rows to Display
              </label>
              <input
                type="number"
                value={maxRows}
                onChange={(e) => setMaxRows(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCreate}
                  onChange={(e) => setAllowCreate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Allow creating new records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowEdit}
                  onChange={(e) => setAllowEdit(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Allow editing records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDelete}
                  onChange={(e) => setAllowDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Allow deleting records</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={collapsible}
                  onChange={(e) => setCollapsible(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Collapsible section</span>
              </label>
              {collapsible && (
                <label className="flex items-center gap-2 cursor-pointer ml-6">
                  <input
                    type="checkbox"
                    checked={defaultCollapsed}
                    onChange={(e) => setDefaultCollapsed(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">Collapsed by default</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <button
          onClick={() => {
            if (step === 'columns') setStep('table');
            else if (step === 'options') setStep('columns');
          }}
          disabled={step === 'table'}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          {step === 'options' ? (
            <button
              onClick={handleSave}
              disabled={!canProceed()}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {existingConfig ? 'Save Changes' : 'Add Embedded List'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 'table') setStep('columns');
                else if (step === 'columns') setStep('options');
              }}
              disabled={!canProceed()}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddedListConfig;
