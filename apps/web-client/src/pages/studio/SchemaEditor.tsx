import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { schemaService, ColumnInfo, CreateTableDto, CreateFieldDto } from '../../services/schema';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Eye, EyeOff, List, SquarePen } from 'lucide-react';

// Data type display mapping
const dataTypeLabels: Record<string, string> = {
  'uuid': 'UUID',
  'character varying': 'Text',
  'varchar': 'Text',
  'text': 'Long Text',
  'integer': 'Integer',
  'numeric': 'Decimal',
  'boolean': 'Boolean',
  'date': 'Date',
  'timestamp with time zone': 'Date/Time',
  'timestamptz': 'Date/Time',
  'time': 'Time',
  'jsonb': 'JSON',
  'ARRAY': 'Array',
};

// Field interface for create mode
interface NewFieldDef {
  code: string;
  label: string;
  type: string;
  required: boolean;
}

export const SchemaEditor = () => {
  const navigate = useNavigate();
  const { tableName: tableParam } = useParams<{ tableName?: string }>();
  const isEditMode = !!tableParam && tableParam !== 'new';

  // View mode state
  const [tableLabel, setTableLabel] = useState('');
  const [fields, setFields] = useState<ColumnInfo[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  // Create mode state
  const [newTableCode, setNewTableCode] = useState('');
  const [newTableLabel, setNewTableLabel] = useState('');
  const [newTableDescription, setNewTableDescription] = useState('');
  const [newFields, setNewFields] = useState<NewFieldDef[]>([
    { code: 'name', label: 'Name', type: 'string', required: true },
  ]);
  const [enableOwnership, setEnableOwnership] = useState(false);
  const [enableOptimisticLocking, setEnableOptimisticLocking] = useState(false);

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditMode || !tableParam) return;

    const loadTable = async () => {
      setIsLoading(true);
      try {
        const response = await schemaService.getTableFields(tableParam, showHidden);
        setTableLabel(tableParam);
        setFields(response.items);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load table');
      } finally {
        setIsLoading(false);
      }
    };

    loadTable();
  }, [isEditMode, tableParam, showHidden]);

  const handleAddField = () => {
    if (isEditMode) return;
    setNewFields([...newFields, { code: '', label: '', type: 'string', required: false }]);
  };

  const handleRemoveField = (index: number) => {
    if (isEditMode) return;
    const updated = [...newFields];
    updated.splice(index, 1);
    setNewFields(updated);
  };

  const handleFieldChange = (index: number, key: keyof NewFieldDef, value: any) => {
    const updated = [...newFields];
    updated[index] = { ...updated[index], [key]: value };
    // Keep code and label in sync if label is empty
    if (key === 'code' && (!updated[index].label || updated[index].label === newFields[index].code)) {
      updated[index].label = value.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    setNewFields(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      navigate('/studio/schema');
      return;
    }
    if (!newTableCode) {
      setError('Table code is required');
      return;
    }
    if (!newTableLabel) {
      setError('Table label is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create the table first
      const createTableDto: CreateTableDto = {
        code: newTableCode,
        label: newTableLabel,
        description: newTableDescription || undefined,
        options: {
          enableOwnership,
          enableOptimisticLocking,
        },
      };

      const createdTable = await schemaService.createTable(createTableDto);

      // Add custom fields
      for (const field of newFields) {
        if (!field.code) continue;
        const createFieldDto: CreateFieldDto = {
          code: field.code,
          label: field.label || field.code,
          type: field.type,
          required: field.required,
        };
        await schemaService.createField(createdTable.tableName, createFieldDto);
      }

      navigate('/studio/schema');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create table');
    } finally {
      setIsLoading(false);
    }
  };

  const getDataTypeLabel = (dataType: string): string => {
    return dataTypeLabels[dataType] || dataType;
  };

  // Render view mode (existing table)
  if (isEditMode) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/studio/schema" className="p-2 rounded-full hover:bg-slate-800 text-slate-400 border border-slate-800">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Studio</p>
                <h1 className="text-2xl font-bold text-slate-100">{tableLabel}</h1>
                <p className="text-sm text-slate-400">{fields.length} columns</p>
              </div>
            </div>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                showHidden
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showHidden ? 'Showing Hidden' : 'Show Hidden'}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/30 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Column</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Label</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-400" title="Show in List">
                      <List className="h-4 w-4 inline" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-400" title="Show in Form">
                      <SquarePen className="h-4 w-4 inline" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fields.map((field) => (
                    <tr key={field.columnName} className={`${field.isHidden ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-200">{field.columnName}</span>
                          {field.isHidden && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400 border border-slate-500/30">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{field.label}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {getDataTypeLabel(field.dataType)}
                        </span>
                        {!field.isNullable && (
                          <span className="ml-2 text-xs text-amber-400">Required</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {field.showInList ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-400">✓</span>
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {field.showInForm ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-400">✓</span>
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono truncate max-w-[150px]">
                        {field.columnDefault || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              to="/studio/schema"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schema
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render create mode (new table)
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/studio/schema" className="p-2 rounded-full hover:bg-slate-800 text-slate-400 border border-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Studio</p>
              <h1 className="text-2xl font-bold text-slate-100">New Table</h1>
              <p className="text-sm text-slate-400">Define your new data structure</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/30 p-6 space-y-6">
            {/* Table Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="tableCode" className="block text-xs font-semibold uppercase text-slate-400">
                  Table Code
                </label>
                <input
                  type="text"
                  id="tableCode"
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. work_order"
                  value={newTableCode}
                  onChange={(e) => setNewTableCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
                <p className="text-xs text-slate-500">
                  Will create table: <span className="font-mono text-sky-400">app_{newTableCode || 'table_name'}</span>
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="tableLabel" className="block text-xs font-semibold uppercase text-slate-400">
                  Display Label
                </label>
                <input
                  type="text"
                  id="tableLabel"
                  className="block w-full rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g. Work Order"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tableDescription" className="block text-xs font-semibold uppercase text-slate-400">
                Description (Optional)
              </label>
              <textarea
                id="tableDescription"
                rows={2}
                className="block w-full rounded-lg border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Describe what this table is for..."
                value={newTableDescription}
                onChange={(e) => setNewTableDescription(e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Table Options</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-sky-500 focus:ring-sky-500 border-slate-700 rounded bg-slate-950/60"
                    checked={enableOwnership}
                    onChange={(e) => setEnableOwnership(e.target.checked)}
                  />
                  <span className="text-sm text-slate-300">Enable Ownership (owner_id field)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-sky-500 focus:ring-sky-500 border-slate-700 rounded bg-slate-950/60"
                    checked={enableOptimisticLocking}
                    onChange={(e) => setEnableOptimisticLocking(e.target.checked)}
                  />
                  <span className="text-sm text-slate-300">Enable Optimistic Locking (row_version field)</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                All tables include: id, created_at, updated_at, created_by, updated_by, is_active, deleted_at
              </p>
            </div>
          </div>

          {/* Fields Section */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl shadow-slate-950/30 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Custom Fields</h3>
                <p className="text-xs text-slate-400">Add fields specific to your data model</p>
              </div>
              <button
                type="button"
                onClick={handleAddField}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 border border-slate-700 hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>

            <div className="space-y-3">
              {newFields.map((field, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-start gap-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Code</label>
                    <input
                      type="text"
                      className="block w-full rounded-md border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="field_code"
                      value={field.code}
                      onChange={(e) => handleFieldChange(index, 'code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Label</label>
                    <input
                      type="text"
                      className="block w-full rounded-md border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Field Label"
                      value={field.label}
                      onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-44 space-y-2">
                    <label className="block text-xs font-medium text-slate-400">Type</label>
                    <select
                      className="block w-full rounded-md border border-slate-800 bg-slate-950/60 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      value={field.type}
                      onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                    >
                      <option value="string">Text</option>
                      <option value="text">Long Text</option>
                      <option value="integer">Integer</option>
                      <option value="decimal">Decimal</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="datetime">Date/Time</option>
                      <option value="choice">Choice</option>
                      <option value="reference">Reference</option>
                      <option value="email">Email</option>
                      <option value="url">URL</option>
                      <option value="currency">Currency</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-sky-500 focus:ring-sky-500 border-slate-700 rounded bg-slate-950/60"
                      checked={field.required}
                      onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                    />
                    <label className="ml-2 block text-sm text-slate-200">Required</label>
                  </div>
                  <div className="pt-5">
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      className="text-slate-500 hover:text-red-500 transition-colors"
                      disabled={newFields.length === 1}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              to="/studio/schema"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-semibold shadow-lg shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Table
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
