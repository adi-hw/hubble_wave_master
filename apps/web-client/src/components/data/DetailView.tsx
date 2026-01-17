/**
 * DetailView Component
 * HubbleWave Platform - Phase 1
 *
 * Production-ready detail view with:
 * - Theme-aware styling using CSS variables
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-friendly 44px touch targets
 * - Keyboard navigation support
 */

import { useState, useMemo, useCallback } from 'react';
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
  Loader2,
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
  const getFieldValue = useCallback((field: FieldDef<T>): unknown => {
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
  }, [record, changes]);

  // Check field visibility
  const isFieldVisible = useCallback((field: FieldDef<T>): boolean => {
    if (field.visible === undefined) return true;
    if (typeof field.visible === 'function') return record ? field.visible(record) : true;
    return field.visible;
  }, [record]);

  // Check if field is readonly
  const isFieldReadonly = useCallback((field: FieldDef<T>): boolean => {
    if (!editing) return true;
    if (field.editable === false) return true;
    if (field.readonly === undefined) return false;
    if (typeof field.readonly === 'function') return record ? field.readonly(record) : false;
    return field.readonly;
  }, [editing, record]);

  // Check section visibility
  const isSectionVisible = useCallback((section: SectionDef<T>): boolean => {
    if (section.visible === undefined) return true;
    if (typeof section.visible === 'function') return record ? section.visible(record) : true;
    return section.visible;
  }, [record]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Handle keyboard navigation for section toggle
  const handleSectionKeyDown = useCallback((e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSection(sectionId);
    }
  }, [toggleSection]);

  // Format display value
  const formatValue = useCallback((field: FieldDef<T>, value: unknown): React.ReactNode => {
    if (field.formatter && record) {
      return field.formatter(value, record);
    }

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground/60">—</span>;
    }

    switch (field.type) {
      case 'boolean':
        return value ? (
          <span className="text-success-text">Yes</span>
        ) : (
          <span className="text-muted-foreground">No</span>
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
          <a
            href={`mailto:${value}`}
            className="text-primary hover:underline"
          >
            {String(value)}
          </a>
        );
      case 'url':
        return (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
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
          <span className="text-primary hover:underline cursor-pointer">
            {String(value)}
          </span>
        );
      default:
        return String(value);
    }
  }, [record]);

  // Render field editor
  const renderEditor = useCallback((field: FieldDef<T>) => {
    const value = getFieldValue(field);
    const fieldKey = typeof field.accessor === 'string' ? field.accessor : field.id;

    if (field.editor) {
      if (typeof field.editor === 'function') {
        return field.editor(value, (newValue) => onChange?.(fieldKey, newValue));
      }
      return field.editor;
    }

    const inputClasses = 'w-full px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

    switch (field.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange?.(fieldKey, e.target.checked)}
              className="w-5 h-5 rounded accent-primary"
              aria-label={field.label}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );
      case 'choice':
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={inputClasses}
            aria-label={field.label}
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
            className={inputClasses}
            aria-label={field.label}
          />
        );
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={inputClasses}
            aria-label={field.label}
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
            className={inputClasses}
            aria-label={field.label}
          />
        );
      case 'richtext':
        return (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            rows={4}
            className={`${inputClasses} min-h-[100px]`}
            aria-label={field.label}
          />
        );
      default:
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={String(value || '')}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            className={inputClasses}
            aria-label={field.label}
          />
        );
    }
  }, [getFieldValue, onChange]);

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
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading record"
      >
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!record) {
    return (
      <div
        className="flex items-center justify-center h-64 text-muted-foreground"
        role="alert"
      >
        Record not found
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      role="main"
      aria-label={resolvedTitle ? String(resolvedTitle) : 'Record details'}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            {resolvedTitle && (
              <h1 className="text-xl font-semibold text-foreground">
                {resolvedTitle}
              </h1>
            )}
            {resolvedSubtitle && (
              <div className="text-sm mt-0.5 text-muted-foreground">
                {resolvedSubtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" role="toolbar" aria-label="Record actions">
          {editing ? (
            <>
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] text-foreground bg-transparent hover:bg-muted"
                aria-label="Cancel editing"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => onSave?.(changes)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="Save changes"
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90"
                  aria-label="Edit record"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {headerActions}
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Sections */}
          {sections.filter(isSectionVisible).map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const visibleFields = section.fields.filter(isFieldVisible);

            if (visibleFields.length === 0) return null;

            return (
              <section
                key={section.id}
                className="rounded-xl overflow-hidden bg-card border border-border"
                aria-labelledby={`section-${section.id}-heading`}
              >
                {/* Section Header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 bg-muted ${
                    section.collapsible ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => section.collapsible && toggleSection(section.id)}
                  onKeyDown={(e) => section.collapsible && handleSectionKeyDown(e, section.id)}
                  role={section.collapsible ? 'button' : undefined}
                  tabIndex={section.collapsible ? 0 : undefined}
                  aria-expanded={section.collapsible ? !isCollapsed : undefined}
                  aria-controls={section.collapsible ? `section-${section.id}-content` : undefined}
                >
                  <div className="flex items-center gap-2">
                    {section.collapsible && (
                      isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )
                    )}
                    {section.icon}
                    <h2
                      id={`section-${section.id}-heading`}
                      className="font-medium text-foreground"
                    >
                      {section.label}
                    </h2>
                  </div>
                </div>

                {/* Section Content */}
                {!isCollapsed && (
                  <div
                    id={`section-${section.id}-content`}
                    className="p-4"
                  >
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
                            <label
                              className="block text-sm font-medium mb-1 text-muted-foreground"
                              htmlFor={`field-${field.id}`}
                            >
                              {field.label}
                              {field.required && (
                                <span
                                  className="ml-1 text-destructive"
                                  aria-label="required"
                                >
                                  *
                                </span>
                              )}
                            </label>
                            {readonly ? (
                              <div
                                id={`field-${field.id}`}
                                className="text-foreground"
                              >
                                {formatValue(field, getFieldValue(field))}
                              </div>
                            ) : (
                              <div id={`field-${field.id}`}>
                                {renderEditor(field)}
                              </div>
                            )}
                            {field.hint && (
                              <p className="mt-1 text-xs text-muted-foreground/60">
                                {field.hint}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* Related Lists */}
          {relatedLists.length > 0 && (
            <section
              className="rounded-xl overflow-hidden bg-card border border-border"
              aria-label="Related records"
            >
              {/* Tabs */}
              <div
                className="flex bg-muted border-b border-border"
                role="tablist"
              >
                {relatedLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setActiveTab(list.id)}
                    className={`px-4 py-3 text-sm font-medium transition-colors min-h-[44px] border-b-2 ${
                      activeTab === list.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    }`}
                    role="tab"
                    aria-selected={activeTab === list.id}
                    aria-controls={`tabpanel-${list.id}`}
                    id={`tab-${list.id}`}
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
                    role="tabpanel"
                    id={`tabpanel-${list.id}`}
                    aria-labelledby={`tab-${list.id}`}
                  >
                    <div className="text-sm text-muted-foreground">
                      Related {list.label.toLowerCase()} will be displayed here.
                    </div>
                    {list.actions}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audit Info */}
          {showAuditInfo && auditInfo && (
            <div
              className="flex items-center gap-6 text-sm px-2 text-muted-foreground/60"
              aria-label="Record audit information"
            >
              {auditInfo.createdAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>
                    Created {new Date(auditInfo.createdAt).toLocaleString()}
                    {auditInfo.createdBy && ` by ${auditInfo.createdBy}`}
                  </span>
                </div>
              )}
              {auditInfo.updatedAt && (
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4" aria-hidden="true" />
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
