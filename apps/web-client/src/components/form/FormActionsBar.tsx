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
    <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-5 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - validation warning */}
        <div className="flex-1">
          {hasErrors && (
            <div className="flex items-center gap-2 text-amber-600">
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
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all
              ${
                hasErrors
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                  : isSubmitting
                    ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-wait'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]'
              }
            `}
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
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-all
              ${
                hasErrors
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : isSubmitting
                    ? 'bg-primary-500 text-white cursor-wait'
                    : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md active:scale-[0.98]'
              }
            `}
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
