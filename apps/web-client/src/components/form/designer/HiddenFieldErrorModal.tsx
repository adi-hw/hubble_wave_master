import React from 'react';
import {
  AlertTriangle,
  X,
  Eye,
  RotateCcw,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { ModelProperty } from '../../../services/platform.service';

interface HiddenPropertyError {
  propertyCode: string;
  propertyLabel: string;
  errorMessage: string;
  isRequired?: boolean;
  isConditionallyRequired?: boolean;
}

// Deprecated alias for backward compatibility
type HiddenFieldError = HiddenPropertyError;

interface HiddenFieldErrorModalProps {
  /**
   * List of hidden properties with validation errors
   */
  errors: HiddenPropertyError[];

  /**
   * All available properties for reference
   */
  properties: ModelProperty[];

  /**
   * Callback when user chooses to show the hidden properties
   */
  onShowProperties: (propertyCodes: string[]) => void;

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

export const HiddenPropertyErrorModal: React.FC<HiddenFieldErrorModalProps> = ({
  errors,
  properties: _properties,
  onShowProperties,
  onResetLayout,
  onClose,
  isSaving: _isSaving = false,
}) => {
  // Group errors by type
  const requiredErrors = errors.filter((e) => e.isRequired);
  const conditionalErrors = errors.filter((e) => e.isConditionallyRequired);
  const otherErrors = errors.filter((e) => !e.isRequired && !e.isConditionallyRequired);

  // Focus trap and modal accessibility
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  React.useEffect(() => {
    // Focus trap - focus the modal when it opens
    if (modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        firstElement.focus();
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/50">
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        className="rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden animate-fade-in bg-card"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-destructive/10 border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h2
                id="modal-title"
                className="text-lg font-semibold text-foreground"
              >
                Cannot Save Form
              </h2>
              <p
                id="modal-description"
                className="text-sm mt-0.5 text-muted-foreground"
              >
                {errors.length === 1
                  ? 'A hidden field has a validation error that must be resolved.'
                  : `${errors.length} hidden fields have validation errors that must be resolved.`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px]"
              aria-label="Close modal"
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
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">
                  Required Fields ({requiredErrors.length})
                </h3>
              </div>
              <div className="space-y-2">
                {requiredErrors.map((error) => (
                  <ErrorRow key={error.propertyCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Conditionally Required Section */}
          {conditionalErrors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning-text" />
                <h3 className="text-sm font-semibold text-foreground">
                  Conditionally Required Fields ({conditionalErrors.length})
                </h3>
              </div>
              <p className="text-xs mb-2 text-muted-foreground">
                These fields are required based on the current form values.
              </p>
              <div className="space-y-2">
                {conditionalErrors.map((error) => (
                  <ErrorRow key={error.propertyCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Other Validation Errors Section */}
          {otherErrors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Other Validation Errors ({otherErrors.length})
                </h3>
              </div>
              <div className="space-y-2">
                {otherErrors.map((error) => (
                  <ErrorRow key={error.propertyCode} error={error} />
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="mt-4 p-3 rounded-lg border bg-info-subtle border-info-border">
            <h4 className="text-xs font-semibold mb-1 text-info-text">
              Why is this happening?
            </h4>
            <p className="text-xs text-info-text">
              Your personalized form layout has hidden some fields that contain validation errors
              or are required for saving. This can happen when:
            </p>
            <ul className="text-xs list-disc list-inside mt-1 space-y-0.5 text-info-text">
              <li>You removed a required field from your layout</li>
              <li>A conditional rule made a hidden field required</li>
              <li>The admin added new required fields after you customized your layout</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-muted border-border">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onResetLayout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg transition-colors text-muted-foreground bg-card border-border hover:bg-muted hover:text-foreground min-h-[44px]"
              >
                <RotateCcw className="h-4 w-4" />
                Use Default Layout
              </button>

              <button
                onClick={() => onShowProperties(errors.map((e) => e.propertyCode))}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-primary-foreground bg-primary hover:bg-primary/90 min-h-[44px]"
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
    <div className="flex items-start gap-3 p-3 border rounded-lg bg-card border-border">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {error.propertyLabel}
          </span>
          {error.isRequired && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-destructive bg-destructive/10">
              Required
            </span>
          )}
          {error.isConditionallyRequired && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-warning-text bg-warning-subtle">
              Conditional
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 text-muted-foreground">
          {error.propertyCode}
        </p>
        <p className="text-xs mt-1 flex items-center gap-1 text-destructive">
          <ChevronRight className="h-3 w-3" />
          {error.errorMessage}
        </p>
      </div>
    </div>
  );
};

// Helper hook for detecting hidden property errors
export function useHiddenPropertyErrors(
  formData: Record<string, unknown>,
  allProperties: ModelProperty[],
  visiblePropertyCodes: Set<string>,
  validateProperty: (propertyCode: string, value: unknown) => string | null
): HiddenPropertyError[] {
  const hiddenProperties = allProperties.filter((p) => !visiblePropertyCodes.has(p.code));

  const errors: HiddenPropertyError[] = [];

  for (const property of hiddenProperties) {
    const value = formData[property.code];
    const errorMessage = validateProperty(property.code, value);

    if (errorMessage) {
      errors.push({
        propertyCode: property.code,
        propertyLabel: property.label,
        errorMessage,
        isRequired: property.config?.validators?.required || false,
        isConditionallyRequired: false, // Would need additional context to determine
      });
    }
  }

  return errors;
}

// Deprecated alias for backward compatibility
export const useHiddenFieldErrors = useHiddenPropertyErrors;

// Utility function to evaluate if a property should be conditionally required
export function evaluateConditionalRequired(
  _propertyCode: string,
  _formData: Record<string, unknown>,
  _conditions: Array<{
    targetProperty: string;
    rules: Array<{
      property: string;
      operator: string;
      value: unknown;
    }>;
  }>
): boolean {
  // Default to false; condition evaluation occurs during form rendering
  return false;
}

// Deprecated alias for backward compatibility
export const HiddenFieldErrorModal = HiddenPropertyErrorModal;

export default HiddenPropertyErrorModal;
