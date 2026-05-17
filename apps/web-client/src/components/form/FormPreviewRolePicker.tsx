import React, { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { apiGet } from '../../lib/api';

interface Role {
  id: string;
  code: string;
  name: string;
}

export interface FormPreviewRolePickerProps {
  /** Currently selected role code(s) for preview, or empty for "as me". */
  value: string[];
  onChange: (roles: string[]) => void;
}

/**
 * Plan §7.2 — Form Builder "Preview as role X" picker.
 *
 * Renders a dropdown of platform roles. When a role is selected,
 * downstream `viewApi.resolve` calls send `?previewAsRole=<code>`.
 * The view-engine controller honors the override only for callers
 * with `metadata:form:manage` or admin (gated server-side), so a
 * delegated form editor can verify their layout under a different
 * role's variant resolution without privilege escalation.
 *
 * Selecting "(my roles)" returns to the caller's actual context.
 */
export const FormPreviewRolePicker: React.FC<FormPreviewRolePickerProps> = ({
  value,
  onChange,
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiGet<{ data: Role[] }>('/admin/roles');
        setRoles(response?.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load roles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedSingle = value[0] ?? '';

  return (
    <div className="inline-flex items-center gap-2 rounded border border-border bg-card px-2 py-1 text-xs">
      <UserCheck size={12} className="text-muted-foreground" />
      <label className="text-muted-foreground">Preview as:</label>
      <select
        value={selectedSingle}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        disabled={loading || !!error}
        className="rounded border-0 bg-transparent text-foreground focus:outline-none"
      >
        <option value="">(my roles)</option>
        {roles.map((r) => (
          <option key={r.id} value={r.code}>
            {r.name} ({r.code})
          </option>
        ))}
      </select>
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  );
};
