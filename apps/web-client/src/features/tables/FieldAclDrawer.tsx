import { useEffect, useState } from 'react';
import { createApiClient } from '../../services/api';

// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

type AccessMode = 'INHERIT' | 'CUSTOM';
type AccessLevel = 'VISIBLE' | 'HIDDEN' | 'MASK_PARTIAL' | 'MASK_FULL';

interface RoleRule {
  role: string;
  access: AccessLevel;
}

interface FieldAcl {
  fieldCode: string;
  read: {
    mode: AccessMode;
    rules: RoleRule[];
  };
  write: {
    mode: AccessMode;
    rules: RoleRule[];
  };
}

interface Props {
  tableCode: string;
  fieldCode: string;
  onClose: () => void;
}

export const FieldAclDrawer: React.FC<Props> = ({ tableCode, fieldCode, onClose }) => {
  const [acl, setAcl] = useState<FieldAcl | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await metadataApi.get(`/studio/tables/${tableCode}/fields/${fieldCode}/acl`);
      setAcl(res.data);
      setLoading(false);
    };
    void load();
  }, [tableCode, fieldCode]);

  const updateReadRule = (idx: number, key: keyof RoleRule, value: string) => {
    setAcl((prev) =>
      prev
        ? {
            ...prev,
            read: {
              ...prev.read,
              rules: prev.read.rules.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
            },
          }
        : prev,
    );
  };

  const updateWriteRule = (idx: number, key: keyof RoleRule, value: string) => {
    setAcl((prev) =>
      prev
        ? {
            ...prev,
            write: {
              ...prev.write,
              rules: prev.write.rules.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
            },
          }
        : prev,
    );
  };

  const addReadRule = () => {
    setAcl((prev) =>
      prev
        ? {
            ...prev,
            read: {
              ...prev.read,
              rules: [...prev.read.rules, { role: '', access: 'VISIBLE' }],
            },
          }
        : prev,
    );
  };

  const addWriteRule = () => {
    setAcl((prev) =>
      prev
        ? {
            ...prev,
            write: {
              ...prev.write,
              rules: [...prev.write.rules, { role: '', access: 'VISIBLE' }],
            },
          }
        : prev,
    );
  };

  const handleSave = async () => {
    if (!acl) return;
    setSaving(true);
    try {
      await metadataApi.patch(`/studio/tables/${tableCode}/fields/${fieldCode}/acl`, acl);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!acl || loading) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/20">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div>
            <div className="text-sm font-semibold">Field access</div>
            <div className="text-[11px] text-slate-500">
              {tableCode} • {fieldCode}
            </div>
          </div>
          <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto px-4 py-3 text-xs">
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase text-slate-500">Read access</legend>
            <label htmlFor="read-inherit" className="inline-flex items-center gap-2">
              <input
                id="read-inherit"
                name="read-mode"
                type="radio"
                checked={acl.read.mode === 'INHERIT'}
                onChange={() => setAcl((prev) => (prev ? { ...prev, read: { ...prev.read, mode: 'INHERIT' } } : prev))}
              />
              <span>Same as table-level read</span>
            </label>
            <label htmlFor="read-custom" className="inline-flex items-center gap-2">
              <input
                id="read-custom"
                name="read-mode"
                type="radio"
                checked={acl.read.mode === 'CUSTOM'}
                onChange={() => setAcl((prev) => (prev ? { ...prev, read: { ...prev.read, mode: 'CUSTOM' } } : prev))}
              />
              <span>Custom per role</span>
            </label>
            {acl.read.mode === 'CUSTOM' && (
              <div className="mt-2 space-y-2">
                {acl.read.rules.map((rule, idx) => (
                  <div key={idx} className="flex gap-2">
                    <label htmlFor={`read-role-${idx}`} className="sr-only">Role for read rule {idx + 1}</label>
                    <input
                      id={`read-role-${idx}`}
                      name={`read-role-${idx}`}
                      autoComplete="off"
                      className="flex-1 rounded border px-2 py-1"
                      placeholder="role slug (e.g. asset_tech)"
                      value={rule.role}
                      onChange={(e) => updateReadRule(idx, 'role', e.target.value)}
                    />
                    <label htmlFor={`read-access-${idx}`} className="sr-only">Access level for read rule {idx + 1}</label>
                    <select
                      id={`read-access-${idx}`}
                      name={`read-access-${idx}`}
                      className="w-32 rounded border px-2 py-1"
                      value={rule.access}
                      onChange={(e) => updateReadRule(idx, 'access', e.target.value as AccessLevel)}
                    >
                      <option value="VISIBLE">Visible</option>
                      <option value="HIDDEN">Hidden</option>
                      <option value="MASK_PARTIAL">Mask partial</option>
                      <option value="MASK_FULL">Mask full</option>
                    </select>
                  </div>
                ))}
                <button type="button" className="rounded border px-2 py-1 text-[11px]" onClick={addReadRule}>
                  Add rule
                </button>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase text-slate-500">Write access</legend>
            <label htmlFor="write-inherit" className="inline-flex items-center gap-2">
              <input
                id="write-inherit"
                name="write-mode"
                type="radio"
                checked={acl.write.mode === 'INHERIT'}
                onChange={() => setAcl((prev) => (prev ? { ...prev, write: { ...prev.write, mode: 'INHERIT' } } : prev))}
              />
              <span>Same as table-level write</span>
            </label>
            <label htmlFor="write-custom" className="inline-flex items-center gap-2">
              <input
                id="write-custom"
                name="write-mode"
                type="radio"
                checked={acl.write.mode === 'CUSTOM'}
                onChange={() => setAcl((prev) => (prev ? { ...prev, write: { ...prev.write, mode: 'CUSTOM' } } : prev))}
              />
              <span>Custom per role</span>
            </label>
            {acl.write.mode === 'CUSTOM' && (
              <div className="mt-2 space-y-2">
                {acl.write.rules.map((rule, idx) => (
                  <div key={idx} className="flex gap-2">
                    <label htmlFor={`write-role-${idx}`} className="sr-only">Role for write rule {idx + 1}</label>
                    <input
                      id={`write-role-${idx}`}
                      name={`write-role-${idx}`}
                      autoComplete="off"
                      className="flex-1 rounded border px-2 py-1"
                      placeholder="role slug (e.g. asset_admin)"
                      value={rule.role}
                      onChange={(e) => updateWriteRule(idx, 'role', e.target.value)}
                    />
                    <label htmlFor={`write-access-${idx}`} className="sr-only">Access level for write rule {idx + 1}</label>
                    <select
                      id={`write-access-${idx}`}
                      name={`write-access-${idx}`}
                      className="w-32 rounded border px-2 py-1"
                      value={rule.access}
                      onChange={(e) => updateWriteRule(idx, 'access', e.target.value as AccessLevel)}
                    >
                      <option value="VISIBLE">Writable</option>
                      <option value="HIDDEN">Hidden</option>
                    </select>
                  </div>
                ))}
                <button type="button" className="rounded border px-2 py-1 text-[11px]" onClick={addWriteRule}>
                  Add rule
                </button>
              </div>
            )}
          </fieldset>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2">
          <button className="rounded px-3 py-1 text-xs text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
