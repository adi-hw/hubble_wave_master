import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { colors } from '../theme/theme';

export interface TypedConfirmDialogField {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface TypedConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  // The exact string the operator must type to enable the confirm button.
  // Intentionally case-sensitive so a casual typo never confirms the action.
  confirmationValue: string;
  confirmationLabel: string;
  confirmButtonLabel: string;
  // Additional fields collected as part of the confirmation form (e.g. revoke
  // reason). Required fields gate the confirm button alongside the typed-name
  // match.
  extraFields?: TypedConfirmDialogField[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (extraValues: Record<string, string>) => void | Promise<void>;
}

export function TypedConfirmDialog({
  open,
  title,
  description,
  confirmationValue,
  confirmationLabel,
  confirmButtonLabel,
  extraFields,
  busy,
  onCancel,
  onConfirm,
}: TypedConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setExtra({});
      // Defer focus so the input exists in the DOM tree.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const typedMatches = typed === confirmationValue;
  const requiredFieldsFilled = (extraFields ?? [])
    .filter((field) => field.required)
    .every((field) => (extra[field.name] ?? '').trim().length > 0);
  const canConfirm = typedMatches && requiredFieldsFilled && !busy;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfirm) return;
    void onConfirm(extra);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="typed-confirm-title"
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/60"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-6 rounded-2xl border"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} style={{ color: colors.danger.base }} />
            <h2
              id="typed-confirm-title"
              className="text-lg font-semibold"
              style={{ color: colors.text.primary }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1.5 rounded transition-colors disabled:opacity-50"
            style={{ color: colors.text.muted }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-sm mb-4" style={{ color: colors.text.secondary }}>
          {description}
        </div>

        <div className="mb-4">
          <label
            htmlFor="typed-confirm-input"
            className="block text-sm font-medium mb-2"
            style={{ color: colors.text.secondary }}
          >
            {confirmationLabel}{' '}
            <code
              className="px-1.5 py-0.5 rounded text-xs"
              style={{
                backgroundColor: colors.glass.medium,
                color: colors.text.primary,
              }}
            >
              {confirmationValue}
            </code>
          </label>
          <input
            id="typed-confirm-input"
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
            style={{
              backgroundColor: colors.glass.medium,
              borderColor: typedMatches ? colors.success.base : colors.glass.border,
              color: colors.text.primary,
            }}
          />
        </div>

        {(extraFields ?? []).map((field) => (
          <div key={field.name} className="mb-4">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: colors.text.secondary }}
            >
              {field.label}
              {field.required ? (
                <span style={{ color: colors.danger.base }}> *</span>
              ) : null}
            </label>
            {field.multiline ? (
              <textarea
                value={extra[field.name] ?? ''}
                onChange={(event) =>
                  setExtra((prev) => ({ ...prev, [field.name]: event.target.value }))
                }
                disabled={busy}
                placeholder={field.placeholder}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none resize-y"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              />
            ) : (
              <input
                type="text"
                value={extra[field.name] ?? ''}
                onChange={(event) =>
                  setExtra((prev) => ({ ...prev, [field.name]: event.target.value }))
                }
                disabled={busy}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              />
            )}
          </div>
        ))}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: colors.danger.base }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmButtonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TypedConfirmDialog;
