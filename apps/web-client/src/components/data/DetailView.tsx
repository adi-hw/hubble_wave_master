import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  X,
  History,
  ExternalLink,
  ArrowLeft,
  Clock,
} from 'lucide-react';

// Types
export interface FieldDef<T = unknown> {
  id: string;
  label: string;
  accessor: keyof T | ((row: T) => unknown);
  type?: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'choice' | 'reference' | 'richtext' | 'email' | 'url' | 'phone' | 'currency' | 'percent' | 'file' | 'image';
  editable?: boolean;
  required?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  options?: { value: string; label: string }[];
  referenceCollection?: string;
  formatter?: (value: unknown, record: T) => React.ReactNode;
  editor?: React.ReactNode | ((value: unknown, onChange: (value: unknown) => void) => React.ReactNode);
  hint?: string;
  visible?: boolean | ((record: T) => boolean);
  readonly?: boolean | ((record: T) => boolean);
}

export interface SectionDef<T = unknown> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  columns?: 1 | 2 | 3;
  fields: FieldDef<T>[];
  visible?: boolean | ((record: T) => boolean);
}

export interface RelatedListDef {
  id: string;
  label: string;
  collection: string;
  foreignKey: string;
  columns: Array<{ id: string; label: string; width?: number }>;
  actions?: React.ReactNode;
}

export interface DetailViewProps<T> {
  record: T | null;
  sections: SectionDef<T>[];
  relatedLists?: RelatedListDef[];
  loading?: boolean;
  editing?: boolean;
  onEditToggle?: () => void;
  onSave?: (updates: Partial<T>) => void;
  onCancel?: () => void;
  onChange?: (field: string, value: unknown) => void;
  changes?: Partial<T>;
  title?: string | ((record: T) => string);
  subtitle?: string | ((record: T) => React.ReactNode);
  headerActions?: React.ReactNode;
  onBack?: () => void;
  showAuditInfo?: boolean;
  auditInfo?: {
    createdAt?: string | Date;
    createdBy?: string;
    updatedAt?: string | Date;
    updatedBy?: string;
  };
  className?: string;
}

const widthClasses = {
  full: 'col-span-12',
  half: 'col-span-12 md:col-span-6',
  third: 'col-span-12 md:col-span-4',
  quarter: 'col-span-12 md:col-span-3',
};

export function DetailView<T extends Record<string, unknown>>({
  record,
  sections,
  relatedLists = [],
  loading = false,
  editing = false,
  onEditToggle,
  onSave,
  onCancel,
  onChange,
  changes = {},
  title,
  subtitle,
  headerActions,
  onBack,
  showAuditInfo = true,
  auditInfo,
  className = '',
}: DetailViewProps<T>) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections.filter((s) => s.defaultCollapsed).map((s) => s.id))
  );
  const [activeTab, setActiveTab] = useState<string | null>(
    relatedLists.length > 0 ? relatedLists[0].id : null
  );

  // Get field value
  const getFieldValue = (field: FieldDef<T>): unknown => {
    if (!record) return null;

    // First check if there's a change for this field
    const fieldKey = typeof field.accessor === 'string' ? field.accessor : field.id;
    if (fieldKey in changes) {
      return changes[fieldKey as keyof T];
    }

    if (typeof field.accessor === 'function') {
      return field.accessor(record);
    }
    return record[field.accessor as keyof T];
  };

  // Check field visibility
  const isFieldVisible = (field: FieldDef<T>): boolean => {
    if (field.visible === undefined) return true;
    if (typeof field.visible === 'function') return record ? field.visible(record) : true;
    return field.visible;
  };

  // Check if field is readonly
  const isFieldReadonly = (field: FieldDef<T>): boolean => {
    if (!editing) return true;
    if (field.editable === false) return true;
    if (field.readonly === undefined) return false;
    if (typeof field.readonly === 'function') return record ? field.readonly(record) : false;
    return field.readonly;
  };

  // Check section visibility
  const isSectionVisible = (section: SectionDef<T>): boolean => {
    if (section.visible === undefined) return true;
    if (typeof section.visible === 'function') return record ? section.visible(record) : true;
    return section.visible;
  };

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Format display value
  const formatValue = (field: FieldDef<T>, value: unknown): React.ReactNode => {
    if (field.formatter && record) {
      return field.formatter(value, record);
    }

    if (value === null || value === undefined) {
      return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    switch (field.type) {
      case 'boolean':
        return value ? (
          <span className="text-green-600 dark:text-green-400">Yes</span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">No</span>
        );
      case 'date':
        return new Date(value as string).toLocaleDateString();
      case 'datetime':
        return new Date(value as string).toLocaleString();
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          Number(value)
        );
      case 'percent':
        return `${Number(value).toFixed(1)}%`;
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
            {String(value)}
          </a>
        );
      case 'url':
        return (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            {String(value)}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      case 'choice':
        const option = field.options?.find((o) => o.value === value);
        return option?.label || String(value);
      case 'reference':
        return (
          <span className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            {String(value)}
          </span>
        );
      default:
        return String(value);
    }
  };

  // Render field editor
  const renderEditor = (field: FieldDef<T>) => {
    const value = getFieldValue(field);
    const fieldKey = typeof field.accessor === 'string' ? field.accessor : field.id;

    if (field.editor) {
      if (typeof field.editor === 'function') {
        return field.editor(value, (newValue) => onChange?.(fieldKey, newValue));
      }
      return field.editor;
    }

    const commonClasses =
      'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';

    switch (field.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange?.(fieldKey, e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );
      case 'choice':
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={commonClasses}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={commonClasses}
          />
        );
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={commonClasses}
          />
        );
      case 'number':
      case 'currency':
      case 'percent':
        return (
          <input
            type="number"
            value={value !== null && value !== undefined ? Number(value) : ''}
            onChange={(e) => onChange?.(fieldKey, e.target.value ? Number(e.target.value) : null)}
            className={commonClasses}
          />
        );
      case 'richtext':
        return (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            rows={4}
            className={commonClasses}
          />
        );
      default:
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={commonClasses}
          />
        );
    }
  };

  // Get title
  const resolvedTitle = useMemo((): React.ReactNode => {
    if (!title) return null;
    if (typeof title === 'function') {
      return record ? title(record) : null;
    }
    return title;
  }, [title, record]);

  // Get subtitle
  const resolvedSubtitle = useMemo((): React.ReactNode => {
    if (!subtitle) return null;
    if (typeof subtitle === 'function') {
      return record ? subtitle(record) : null;
    }
    return subtitle;
  }, [subtitle, record]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Record not found
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
          )}
          <div>
            {resolvedTitle && (
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {resolvedTitle}
              </h1>
            )}
            {resolvedSubtitle && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {resolvedSubtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => onSave?.(changes)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <>
              {onEditToggle && (
                <button
                  onClick={onEditToggle}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {headerActions}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Sections */}
          {sections.filter(isSectionVisible).map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const visibleFields = section.fields.filter(isFieldVisible);

            if (visibleFields.length === 0) return null;

            return (
              <div
                key={section.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Section Header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 ${
                    section.collapsible ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''
                  }`}
                  onClick={() => section.collapsible && toggleSection(section.id)}
                >
                  <div className="flex items-center gap-2">
                    {section.collapsible && (
                      isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )
                    )}
                    {section.icon}
                    <h2 className="font-medium text-gray-900 dark:text-white">{section.label}</h2>
                  </div>
                </div>

                {/* Section Content */}
                {!isCollapsed && (
                  <div className="p-4">
                    <div
                      className={`grid grid-cols-12 gap-4 ${
                        section.columns === 1
                          ? ''
                          : section.columns === 3
                          ? 'md:gap-6'
                          : ''
                      }`}
                    >
                      {visibleFields.map((field) => {
                        const width = field.width || (section.columns === 1 ? 'full' : 'half');
                        const readonly = isFieldReadonly(field);

                        return (
                          <div key={field.id} className={widthClasses[width]}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {readonly ? (
                              <div className="text-gray-900 dark:text-gray-100">
                                {formatValue(field, getFieldValue(field))}
                              </div>
                            ) : (
                              renderEditor(field)
                            )}
                            {field.hint && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {field.hint}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Related Lists */}
          {relatedLists.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {relatedLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setActiveTab(list.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === list.id
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {list.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {relatedLists.map((list) => (
                  <div
                    key={list.id}
                    className={activeTab === list.id ? 'block' : 'hidden'}
                  >
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Related {list.label.toLowerCase()} will be displayed here.
                    </div>
                    {list.actions}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Info */}
          {showAuditInfo && auditInfo && (
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 px-2">
              {auditInfo.createdAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    Created {new Date(auditInfo.createdAt).toLocaleString()}
                    {auditInfo.createdBy && ` by ${auditInfo.createdBy}`}
                  </span>
                </div>
              )}
              {auditInfo.updatedAt && (
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>
                    Updated {new Date(auditInfo.updatedAt).toLocaleString()}
                    {auditInfo.updatedBy && ` by ${auditInfo.updatedBy}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
