import React from 'react';
import {
  AlertTriangle,
  X,
  Eye,
  RotateCcw,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { ModelField } from '../../../services/platform.service';

interface HiddenFieldError {
  fieldCode: string;
  fieldLabel: string;
  errorMessage: string;
  isRequired?: boolean;
  isConditionallyRequired?: boolean;
}

interface HiddenFieldErrorModalProps {
  /**
   * List of hidden fields with validation errors
   */
  errors: HiddenFieldError[];

  /**
   * All available fields for reference
   */
  fields: ModelField[];

  /**
   * Callback when user chooses to show the hidden fields
   */
  onShowFields: (fieldCodes: string[]) => void;

  /**
   * Callback when user chooses to reset to default layout
   */
  onResetLayout: () => void;

  /**
   * Callback to close the modal without action
   */
  onClose: () => void;

  /**
   * Whether the save is being attempted
   */
  isSaving?: boolean;
}

export const HiddenFieldErrorModal: React.FC<HiddenFieldErrorModalProps> = ({
  errors,
  fields: _fields,
  onShowFields,
  onResetLayout,
  onClose,
  isSaving: _isSaving = false,
}) => {
  // Group errors by type
  const requiredErrors = errors.filter((e) => e.isRequired);
  const conditionalErrors = errors.filter((e) => e.isConditionallyRequired);
  const otherErrors = errors.filter((e) => !e.isRequired && !e.isConditionallyRequired);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-red-50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">
                Cannot Save Form
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {errors.length === 1
                  ? 'A hidden field has a validation error that must be resolved.'
                  : `${errors.length} hidden fields have validation errors that must be resolved.`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Required Fields Section */}
          {requiredErrors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Required Fields ({requiredErrors.length})
                </h3>
              </div>
              <div className="space-y-2">
                {requiredErrors.map((error) => (
                  <ErrorRow key={error.fieldCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Conditionally Required Section */}
          {conditionalErrors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Conditionally Required Fields ({conditionalErrors.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                These fields are required based on the current form values.
              </p>
              <div className="space-y-2">
                {conditionalErrors.map((error) => (
                  <ErrorRow key={error.fieldCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Other Validation Errors Section */}
          {otherErrors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Other Validation Errors ({otherErrors.length})
                </h3>
              </div>
              <div className="space-y-2">
                {otherErrors.map((error) => (
                  <ErrorRow key={error.fieldCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="text-xs font-semibold text-blue-800 mb-1">Why is this happening?</h4>
            <p className="text-xs text-blue-700">
              Your personalized form layout has hidden some fields that contain validation errors
              or are required for saving. This can happen when:
            </p>
            <ul className="text-xs text-blue-700 list-disc list-inside mt-1 space-y-0.5">
              <li>You removed a required field from your layout</li>
              <li>A conditional rule made a hidden field required</li>
              <li>The admin added new required fields after you customized your layout</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onResetLayout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Use Default Layout
              </button>

              <button
                onClick={() => onShowFields(errors.map((e) => e.fieldCode))}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Show Hidden Fields
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual error row component
const ErrorRow: React.FC<{ error: HiddenFieldError }> = ({ error }) => {
  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="h-4 w-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{error.fieldLabel}</span>
          {error.isRequired && (
            <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              Required
            </span>
          )}
          {error.isConditionallyRequired && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Conditional
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{error.fieldCode}</p>
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {error.errorMessage}
        </p>
      </div>
    </div>
  );
};

// Helper hook for detecting hidden field errors
export function useHiddenFieldErrors(
  formData: Record<string, unknown>,
  allFields: ModelField[],
  visibleFieldCodes: Set<string>,
  validateField: (fieldCode: string, value: unknown) => string | null
): HiddenFieldError[] {
  const hiddenFields = allFields.filter((f) => !visibleFieldCodes.has(f.code));

  const errors: HiddenFieldError[] = [];

  for (const field of hiddenFields) {
    const value = formData[field.code];
    const errorMessage = validateField(field.code, value);

    if (errorMessage) {
      errors.push({
        fieldCode: field.code,
        fieldLabel: field.label,
        errorMessage,
        isRequired: field.config?.validators?.required || false,
        isConditionallyRequired: false, // Would need additional context to determine
      });
    }
  }

  return errors;
}

// Utility function to evaluate if a field should be conditionally required
export function evaluateConditionalRequired(
  _fieldCode: string,
  _formData: Record<string, unknown>,
  _conditions: Array<{
    targetField: string;
    rules: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  }>
): boolean {
  // This would evaluate the conditional rules against current form data
  // Placeholder implementation - would need actual condition evaluation
  return false;
}

export default HiddenFieldErrorModal;
