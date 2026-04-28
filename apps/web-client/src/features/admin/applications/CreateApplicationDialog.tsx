import React, { useEffect, useMemo, useState } from 'react';
import { AppWindow, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Application, applicationsApi } from '../../../lib/applications';

interface CreateApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (created: Application) => void;
  /**
   * Codes already in use, so we can warn before submission rather than
   * relying on the backend ConflictException round-trip.
   */
  existingCodes?: string[];
}

const CODE_PATTERN = /^[a-z][a-z0-9_-]*$/;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, 'a$1') // codes must start with a letter
    .slice(0, 120);
}

export const CreateApplicationDialog: React.FC<CreateApplicationDialogProps> = ({
  open,
  onClose,
  onCreated,
  existingCodes = [],
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the dialog opens.
  useEffect(() => {
    if (open) {
      setName('');
      setCode('');
      setCodeTouched(false);
      setDescription('');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  // Auto-derive code from name until the user touches the code field.
  useEffect(() => {
    if (!codeTouched) {
      setCode(slugify(name));
    }
  }, [name, codeTouched]);

  const codeIssue = useMemo(() => {
    if (!code) return null;
    if (!CODE_PATTERN.test(code)) {
      return 'Code must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores.';
    }
    if (existingCodes.includes(code)) {
      return 'An Application with this code already exists.';
    }
    return null;
  }, [code, existingCodes]);

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    code.length > 0 &&
    !codeIssue;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await applicationsApi.create({
        code,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create Application';
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Create Application"
      description="Group Collections, Forms, and Workflows under a named Application. The code is permanent — choose carefully."
      icon={<AppWindow size={20} className="text-primary" />}
      size="md"
      closeOnBackdropClick={!submitting}
      closeOnEscape={!submitting}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-application-form"
            disabled={!canSubmit}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Create
          </Button>
        </div>
      }
    >
      <form id="create-application-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="application-name"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Name
          </label>
          <Input
            id="application-name"
            placeholder="e.g. HR Operations"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={submitting}
            required
            maxLength={255}
          />
        </div>

        <div>
          <label
            htmlFor="application-code"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Code
          </label>
          <Input
            id="application-code"
            placeholder="e.g. hr-operations"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toLowerCase());
              setCodeTouched(true);
            }}
            disabled={submitting}
            required
            maxLength={120}
            className="font-mono"
          />
          {codeIssue ? (
            <p className="mt-1 text-xs text-destructive">{codeIssue}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Used in API paths and cross-Application references. Cannot be changed
              after creation.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="application-description"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Description{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="application-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            maxLength={4000}
            rows={3}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="What this Application is for, who owns it."
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
};
