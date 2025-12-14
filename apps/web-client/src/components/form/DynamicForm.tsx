import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ModelField } from '../../services/platform.service';
import { useModel } from '../../hooks/useModel';
import { FormLayout } from './FormLayout';
import { FormLayoutDesigner, DesignerLayout, generateId } from './designer';
import {
  Loader2,
  AlertCircle,
  Save,
  CheckCircle,
  Trash2,
  Copy,
  FileEdit,
  Check,
  ChevronDown,
  User,
  Building2,
  Sparkles,
  ArrowLeft,
  FileDown,
} from 'lucide-react';

/** Generic form data type - maps field codes to their values */
export type FormData = Record<string, unknown>;

interface DynamicFormProps {
  tableCode: string;
  tableLabel?: string;
  recordLabel?: string;
  recordId?: string;
  onSubmit: (data: FormData, goBack?: boolean) => void | Promise<void>;
  initialData?: FormData;
  hideSubmit?: boolean;
  headerContent?: React.ReactNode;
  onBack?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  tableCode,
  tableLabel,
  recordLabel,
  onSubmit,
  initialData,
  hideSubmit,
  headerContent,
  onBack,
  onDelete,
  onDuplicate,
}) => {
  const { fields, layout, loading, error } = useModel(tableCode);
  const initialDataMemo = useMemo(() => initialData || {}, [initialData]);
  const [formData, setFormData] = useState<FormData>(initialDataMemo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<'stay' | 'go' | false>(false);
  const [showLayoutDesigner, setShowLayoutDesigner] = useState(false);
  const [showLayoutSwitcher, setShowLayoutSwitcher] = useState(false);
  const [activeLayoutType, setActiveLayoutType] = useState<'default' | 'personal'>('default');
  const [personalLayout, setPersonalLayout] = useState<DesignerLayout | null>(null);
  const layoutSwitcherRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setFormData(initialDataMemo);
  }, [initialDataMemo]);

  // Format value for PDF display
  const formatValueForPdf = (value: unknown, fieldType?: string): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    if (fieldType === 'date' && value) {
      return new Date(String(value)).toLocaleDateString();
    }
    if (fieldType === 'datetime' && value) {
      return new Date(String(value)).toLocaleString();
    }
    return String(value);
  };

  // Display title computed from props (used in header and PDF export)
  const displayTitle = recordLabel || tableLabel || tableCode;

  // Export form to PDF using jsPDF text-based approach
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;

      // Helper to add new page if needed
      const checkNewPage = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(displayTitle, margin, yPos + 7);
      yPos += 12;

      // Subtitle with date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yPos);
      yPos += 8;

      // Divider line
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Render fields
      const labelWidth = 50;
      const valueStartX = margin + labelWidth + 5;
      const valueWidth = contentWidth - labelWidth - 5;

      for (const field of fields) {
        const value = formData[field.code];
        const formattedValue = formatValueForPdf(value, field.type);

        // Calculate height needed for this field
        pdf.setFontSize(10);
        const valueLines = pdf.splitTextToSize(formattedValue, valueWidth);
        const fieldHeight = Math.max(7, valueLines.length * 5 + 2);

        checkNewPage(fieldHeight + 5);

        // Draw field background
        pdf.setFillColor(248, 250, 252); // slate-50
        pdf.roundedRect(margin, yPos - 1, contentWidth, fieldHeight + 2, 2, 2, 'F');

        // Field label
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139); // slate-500
        pdf.text(field.label, margin + 3, yPos + 4);

        // Field value
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59); // slate-800

        if (valueLines.length === 1) {
          pdf.text(valueLines[0], valueStartX, yPos + 4);
        } else {
          let lineY = yPos + 4;
          for (const line of valueLines) {
            pdf.text(line, valueStartX, lineY);
            lineY += 5;
          }
        }

        yPos += fieldHeight + 4;
      }

      const filename = recordLabel || tableLabel || tableCode;
      pdf.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutSwitcherRef.current && !layoutSwitcherRef.current.contains(e.target as Node)) {
        setShowLayoutSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle saving personal layout from designer
  const handleSaveLayout = async (newLayout: DesignerLayout) => {
    setPersonalLayout(newLayout);
    setActiveLayoutType('personal');
    setShowLayoutDesigner(false);
    // TODO: Save to user_layout_preferences API
  };

  // Convert admin layout to designer layout format
  const getDesignerLayout = (): DesignerLayout => {
    if (personalLayout && activeLayoutType === 'personal') {
      return personalLayout;
    }

    // Type for layout tabs from API
    interface LayoutTab {
      id?: string;
      label?: string;
      icon?: string;
      sections?: LayoutSection[];
    }

    interface LayoutSection {
      id?: string;
      label: string;
      columns?: number;
      collapsible?: boolean;
      defaultCollapsed?: boolean;
      fields?: string[];
    }

    // Convert current layout to designer format
    if (layout?.layout?.tabs) {
      const tabs = layout.layout.tabs as LayoutTab[];
      return {
        version: 2,
        tabs: tabs.map((tab, tabIdx) => ({
          id: tab.id || `tab-${tabIdx}`,
          label: tab.label || `Tab ${tabIdx + 1}`,
          icon: tab.icon || 'layers',
          sections: (tab.sections || []).map((section, secIdx) => ({
            id: section.id || `section-${tabIdx}-${secIdx}`,
            label: section.label,
            columns: (section.columns || 2) as 1 | 2 | 3 | 4,
            collapsible: section.collapsible ?? false,
            defaultCollapsed: section.defaultCollapsed ?? false,
            items: (section.fields || []).map((fieldCode: string) => ({
              type: 'field' as const,
              id: generateId(),
              fieldCode,
              span: 1 as const,
            })),
          })),
        })),
      };
    }

    // Create default layout from fields
    return {
      version: 2,
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          icon: 'file-text',
          sections: [
            {
              id: generateId(),
              label: 'General Information',
              columns: 2,
              items: fields.map((f) => ({
                type: 'field' as const,
                id: generateId(),
                fieldCode: f.code,
                span: 1,
              })),
            },
          ],
        },
      ],
    };
  };

  const validateField = (field: ModelField, value: unknown): boolean => {
    const validators = field.config?.validators || {};
    let errorMsg = '';

    if (validators.required) {
      if (value === null || value === undefined || value === '') {
        errorMsg = validators.customError || `${field.label} is required`;
      }
    }

    if (!errorMsg && value !== null && value !== undefined && value !== '') {
      if (field.type === 'string' || field.type === 'text' || field.type === 'rich_text') {
        const strValue = String(value);
        if (validators.minLength && strValue.length < validators.minLength) {
          errorMsg =
            validators.customError ||
            `${field.label} must be at least ${validators.minLength} characters`;
        } else if (validators.maxLength && strValue.length > validators.maxLength) {
          errorMsg =
            validators.customError ||
            `${field.label} must be no more than ${validators.maxLength} characters`;
        } else if (validators.pattern) {
          try {
            const regex = new RegExp(validators.pattern);
            if (!regex.test(strValue)) {
              errorMsg = validators.customError || `${field.label} format is invalid`;
            }
          } catch (e) {
            console.error('Invalid regex pattern:', validators.pattern);
          }
        }
      }

      if (field.type === 'integer' || field.type === 'number' || field.type === 'long' || field.type === 'decimal') {
        const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
        if (!isNaN(numValue)) {
          if (validators.min !== undefined && numValue < validators.min) {
            errorMsg =
              validators.customError ||
              `${field.label} must be at least ${validators.min}`;
          } else if (validators.max !== undefined && numValue > validators.max) {
            errorMsg =
              validators.customError ||
              `${field.label} must be no more than ${validators.max}`;
          }
        }
      }
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (errorMsg) {
        next[field.code] = errorMsg;
      } else {
        delete next[field.code];
      }
      return next;
    });

    return !errorMsg;
  };

  const handleChange = (field: ModelField, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field.code]: value }));
    validateField(field, value);
  };

  const validateAll = () => {
    let isValid = true;
    fields.forEach((field) => {
      if (!validateField(field, formData[field.code])) {
        isValid = false;
      }
    });
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave(false);
  };

  const handleSave = async (goBack: boolean) => {
    if (!validateAll()) return;

    setSubmitting(goBack ? 'go' : 'stay');
    try {
      await onSubmit(formData, goBack);
    } finally {
      setSubmitting(false);
    }
  };

  const totalErrors = Object.keys(errors).length;
  const isSubmitting = !!submitting;
  const canSave = !hideSubmit && !isSubmitting && totalErrors === 0;

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] min-h-[500px] bg-white border border-danger-200 rounded-2xl shadow-sm flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-full bg-danger-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-7 w-7 text-danger-600" />
        </div>
        <h3 className="text-base font-semibold text-danger-700 mb-1">Unable to load form</h3>
        <p className="text-sm text-danger-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-danger-200 bg-white text-danger-700 hover:bg-danger-50 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="dynamic-form h-[calc(100vh-8rem)] min-h-[500px] w-full flex flex-col bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Sticky Header with Title and Icon Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white flex-shrink-0 sticky top-0 z-10">
        {/* Left side - Back button, Title and mode icon */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Back Button */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-shrink-0 text-slate-600">
            <FileEdit className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 truncate">
            {displayTitle}
          </h2>
          {totalErrors > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger-50 text-danger-600 flex-shrink-0">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">
                {totalErrors} error{totalErrors !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {headerContent}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {/* Tool buttons group */}
          <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5">
            {/* Save buttons - Edit mode only */}
            {!hideSubmit && (
              <>
                {/* Save (stay) */}
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={!canSave}
                  className={`
                    h-8 w-8 flex items-center justify-center rounded-lg transition-all
                    ${canSave
                      ? 'text-slate-600 hover:text-primary-600 hover:bg-white hover:shadow-sm'
                      : 'text-slate-300 cursor-not-allowed'
                    }
                  `}
                  title="Save"
                >
                  {submitting === 'stay' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </button>

                {/* Save & Close */}
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={!canSave}
                  className={`
                    h-8 w-8 flex items-center justify-center rounded-lg transition-all
                    ${canSave
                      ? 'text-slate-600 hover:text-success-600 hover:bg-white hover:shadow-sm'
                      : 'text-slate-300 cursor-not-allowed'
                    }
                  `}
                  title="Save & Close"
                >
                  {submitting === 'go' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </button>

                {/* Duplicate */}
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={onDuplicate}
                    disabled={isSubmitting}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm transition-all disabled:text-slate-300 disabled:cursor-not-allowed"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}

                {/* Delete */}
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={isSubmitting}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-danger-600 hover:bg-white hover:shadow-sm transition-all disabled:text-slate-300 disabled:cursor-not-allowed"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
              </>
            )}

            {/* Export PDF - Always visible */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm transition-all disabled:text-slate-300 disabled:cursor-not-allowed"
              title="Export to PDF"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </button>

            {/* Layout Switcher - Edit mode only */}
            {!hideSubmit && (
              <>
                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                {/* Layout Switcher */}
                <div ref={layoutSwitcherRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLayoutSwitcher(!showLayoutSwitcher)}
                    className={`
                      h-8 px-2.5 flex items-center gap-1.5 rounded-lg transition-all
                      ${showLayoutSwitcher
                        ? 'bg-primary-600 text-white shadow-sm'
                        : activeLayoutType === 'personal'
                          ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white hover:shadow-sm'
                      }
                    `}
                    title="Switch layout"
                  >
                    {activeLayoutType === 'personal' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {/* Layout Switcher Dropdown */}
                  {showLayoutSwitcher && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[200px]">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Form Layout
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveLayoutType('default');
                          setShowLayoutSwitcher(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          activeLayoutType === 'default'
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                        <span className="flex-1 text-left">Default Layout</span>
                        {activeLayoutType === 'default' && <Check className="h-4 w-4" />}
                      </button>

                      {personalLayout && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLayoutType('personal');
                            setShowLayoutSwitcher(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            activeLayoutType === 'personal'
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <User className="h-4 w-4" />
                          <span className="flex-1 text-left">My Layout</span>
                          {activeLayoutType === 'personal' && <Check className="h-4 w-4" />}
                        </button>
                      )}

                      <div className="h-px bg-slate-100 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setShowLayoutSwitcher(false);
                          setShowLayoutDesigner(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span className="flex-1 text-left font-medium">Customize Layout...</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto">
        <FormLayout
          fields={fields}
          layout={layout}
          values={formData}
          errors={errors}
          onChange={handleChange}
        />
      </div>

      {/* Layout Designer Modal */}
      {showLayoutDesigner && (
        <FormLayoutDesigner
          tableCode={tableCode}
          fields={fields}
          initialLayout={getDesignerLayout()}
          onSave={handleSaveLayout}
          onClose={() => setShowLayoutDesigner(false)}
        />
      )}
    </form>
  );
};
