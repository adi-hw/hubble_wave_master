import React from 'react';
import { Loader2, Check, ArrowRight, AlertTriangle } from 'lucide-react';

interface FormActionsBarProps {
  submitting?: 'stay' | 'go' | false;
  hideSubmit?: boolean;
  hasErrors?: boolean;
  onSaveAndStay?: () => void;
  onSaveAndGo?: () => void;
  mode?: 'create' | 'edit' | 'view';
}

export const FormActionsBar: React.FC<FormActionsBarProps> = ({
  submitting,
  hideSubmit,
  hasErrors,
  onSaveAndStay,
  onSaveAndGo,
  mode = 'edit',
}) => {
  if (hideSubmit) return null;

  const isSubmitting = !!submitting;
  const saveLabel = mode === 'create' ? 'Create' : 'Save';

  return (
    <div
      className="sticky bottom-0 px-5 py-4 backdrop-blur-sm"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Left side - validation warning */}
        <div className="flex-1">
          {hasErrors && (
            <div className="flex items-center gap-2" style={{ color: 'var(--text-warning)' }}>
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Please fix validation errors before saving</span>
            </div>
          )}
        </div>

        {/* Right side - buttons */}
        <div className="flex items-center gap-3">
          {/* Save & Stay */}
          <button
            type="button"
            onClick={onSaveAndStay}
            disabled={isSubmitting || hasErrors}
            className="btn btn-secondary"
          >
            {submitting === 'stay' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{saveLabel}</span>
              </>
            )}
          </button>

          {/* Save & Go */}
          <button
            type="button"
            onClick={onSaveAndGo}
            disabled={isSubmitting || hasErrors}
            className="btn btn-primary"
          >
            {submitting === 'go' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>{saveLabel} & Close</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
