import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  Link2,
  Search,
  X,
  Plus,
  Loader2,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { ModelField } from '../../../services/platform.service';

interface DotWalkSelectorProps {
  /**
   * The base table code to start navigating from
   */
  baseTableCode: string;

  /**
   * Fields of the base table (should include reference fields)
   */
  baseFields: ModelField[];

  /**
   * Function to fetch fields for a related table
   */
  onFetchTableFields: (tableCode: string) => Promise<ModelField[]>;

  /**
   * Maximum depth of reference traversal (default: 3)
   */
  maxDepth?: number;

  /**
   * Callback when a field is selected
   */
  onSelectField: (fieldPath: string[], displayLabel: string, finalField: ModelField) => void;

  /**
   * Callback to close the selector
   */
  onClose: () => void;
}

interface PathNode {
  tableCode: string;
  fieldCode: string;
  fieldLabel: string;
  fields: ModelField[];
  isLoading: boolean;
}

export const DotWalkSelector: React.FC<DotWalkSelectorProps> = ({
  baseTableCode,
  baseFields,
  onFetchTableFields,
  maxDepth = 3,
  onSelectField,
  onClose,
}) => {
  const [path, setPath] = useState<PathNode[]>([
    {
      tableCode: baseTableCode,
      fieldCode: '',
      fieldLabel: baseTableCode,
      fields: baseFields,
      isLoading: false,
    },
  ]);
  const [search, setSearch] = useState('');
  const [selectedField, setSelectedField] = useState<ModelField | null>(null);

  // Get current node
  const currentNode = path[path.length - 1];
  const canGoDeeper = path.length < maxDepth;

  // Filter fields by search
  const filteredFields = useMemo(() => {
    if (!currentNode.fields) return [];
    if (!search.trim()) return currentNode.fields;

    const term = search.toLowerCase();
    return currentNode.fields.filter(
      (f) =>
        f.label.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term)
    );
  }, [currentNode.fields, search]);

  // Group fields by type
  const groupedFields = useMemo(() => {
    const references: ModelField[] = [];
    const others: ModelField[] = [];

    filteredFields.forEach((field) => {
      if (isReferenceField(field.type)) {
        references.push(field);
      } else {
        others.push(field);
      }
    });

    return { references, others };
  }, [filteredFields]);

  // Get reference table from field config
  const getReferenceTable = (field: ModelField): string | undefined => {
    // Reference table is typically stored in field.config.referenceTable
    return field.config?.referenceTable || field.config?.reference_table;
  };

  // Navigate into a reference field
  const handleNavigateInto = async (field: ModelField) => {
    const refTable = getReferenceTable(field);
    if (!isReferenceField(field.type) || !refTable) return;
    if (!canGoDeeper) return;

    // Add new loading node
    const newNode: PathNode = {
      tableCode: refTable,
      fieldCode: field.code,
      fieldLabel: field.label,
      fields: [],
      isLoading: true,
    };
    setPath([...path, newNode]);
    setSearch('');
    setSelectedField(null);

    // Fetch fields for the referenced table
    try {
      const fields = await onFetchTableFields(refTable);
      setPath((prev) => {
        const updated = [...prev];
        const lastNode = updated[updated.length - 1];
        if (lastNode.tableCode === refTable) {
          lastNode.fields = fields;
          lastNode.isLoading = false;
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch table fields:', error);
      setPath((prev) => {
        const updated = [...prev];
        const lastNode = updated[updated.length - 1];
        lastNode.isLoading = false;
        return updated;
      });
    }
  };

  // Go back one level
  const handleGoBack = () => {
    if (path.length <= 1) return;
    setPath(path.slice(0, -1));
    setSearch('');
    setSelectedField(null);
  };

  // Navigate to a specific level
  const handleNavigateTo = (index: number) => {
    if (index === path.length - 1) return;
    setPath(path.slice(0, index + 1));
    setSearch('');
    setSelectedField(null);
  };

  // Handle field selection
  const handleSelectField = (field: ModelField) => {
    if (isReferenceField(field.type)) {
      // For reference fields, allow both selecting and navigating
      setSelectedField(field);
    } else {
      setSelectedField(field);
    }
  };

  // Confirm selection
  const handleConfirmSelection = () => {
    if (!selectedField) return;

    // Build the full path
    const fieldPath = path.slice(1).map((node) => node.fieldCode);
    fieldPath.push(selectedField.code);

    // Build display label
    const labels = path.slice(1).map((node) => node.fieldLabel);
    labels.push(selectedField.label);
    const displayLabel = labels.join(' → ');

    onSelectField(fieldPath, displayLabel, selectedField);
  };

  // Get breadcrumb path string
  const pathString = path.slice(1).map((node) => node.fieldCode).join('.');

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-96 max-h-[500px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-pink-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Dot-Walk Field</h3>
              <p className="text-[10px] text-slate-500">Navigate through references</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {path.map((node, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-slate-300 flex-shrink-0" />
              )}
              <button
                onClick={() => handleNavigateTo(index)}
                className={`px-2 py-1 rounded transition-colors ${
                  index === path.length - 1
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {index === 0 ? node.tableCode : node.fieldLabel}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Current path display */}
        {pathString && (
          <div className="mt-2 px-2 py-1.5 bg-slate-50 rounded text-xs font-mono text-slate-600">
            {baseTableCode}.{pathString}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full h-8 pl-8 pr-8 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-2">
        {currentNode.isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-sm">Loading fields...</span>
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Search className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">No fields found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Back button if not at root */}
            {path.length > 1 && (
              <button
                onClick={handleGoBack}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {path[path.length - 2].fieldLabel || path[path.length - 2].tableCode}
              </button>
            )}

            {/* Reference fields (navigable) */}
            {canGoDeeper && groupedFields.references.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  References ({groupedFields.references.length})
                </h4>
                <div className="space-y-1">
                  {groupedFields.references.map((field) => (
                    <div
                      key={field.code}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedField?.code === field.code
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                      onClick={() => handleSelectField(field)}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-pink-50 text-pink-600">
                        <Link2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {field.label}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {field.code} → {getReferenceTable(field)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateInto(field);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Navigate into"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other fields */}
            {groupedFields.others.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Fields ({groupedFields.others.length})
                </h4>
                <div className="space-y-1">
                  {groupedFields.others.map((field) => (
                    <div
                      key={field.code}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedField?.code === field.code
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                      onClick={() => handleSelectField(field)}
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${getFieldTypeColor(field.type)}`}>
                        {getFieldTypeIcon(field.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {field.label}
                        </p>
                        <p className="text-[10px] text-slate-400">{field.code}</p>
                      </div>
                      {selectedField?.code === field.code && (
                        <Check className="h-4 w-4 text-primary-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {path.length > 1 && selectedField && (
            <span className="font-mono">{pathString}.{selectedField.code}</span>
          )}
          {path.length === 1 && selectedField && (
            <span className="text-slate-400 italic">Select from a reference table</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedField || path.length === 1}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Field
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
function isReferenceField(type: string): boolean {
  return ['reference', 'multi_reference', 'user_reference'].includes(type.toLowerCase());
}

function getFieldTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (['string', 'text', 'rich_text'].includes(t)) return 'bg-slate-100 text-slate-600';
  if (['integer', 'long', 'decimal', 'number', 'currency', 'percent'].includes(t)) return 'bg-blue-50 text-blue-600';
  if (['date', 'datetime', 'time', 'duration'].includes(t)) return 'bg-purple-50 text-purple-600';
  if (['boolean', 'choice', 'multi_choice', 'tags'].includes(t)) return 'bg-amber-50 text-amber-600';
  if (['email', 'phone', 'url'].includes(t)) return 'bg-cyan-50 text-cyan-600';
  if (['file', 'image'].includes(t)) return 'bg-green-50 text-green-600';
  return 'bg-slate-100 text-slate-500';
}

function getFieldTypeIcon(type: string): React.ReactNode {
  // Simple text representation for now
  const t = type.toLowerCase();
  if (['string', 'text'].includes(t)) return <span className="text-[10px] font-bold">Aa</span>;
  if (['integer', 'long', 'decimal', 'number'].includes(t)) return <span className="text-[10px] font-bold">#</span>;
  if (['date', 'datetime'].includes(t)) return <span className="text-[10px] font-bold">📅</span>;
  if (['boolean'].includes(t)) return <span className="text-[10px] font-bold">✓</span>;
  return <span className="text-[10px] font-bold">•</span>;
}

export default DotWalkSelector;
