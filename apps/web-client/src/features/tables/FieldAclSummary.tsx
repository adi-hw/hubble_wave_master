import { useState } from 'react';
import type { AuthorizedFieldMeta } from './types';
import { FieldAclDrawer } from './FieldAclDrawer';

interface Props {
  tableCode: string;
  fields: AuthorizedFieldMeta[];
}

export const FieldAclSummary: React.FC<Props> = ({ tableCode, fields }) => {
  const [openFieldCode, setOpenFieldCode] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold">Field access</h3>
          <p className="text-[11px] text-slate-500">Override table-level access for specific fields.</p>
        </div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border px-2 py-1 text-left">Field</th>
            <th className="border px-2 py-1 text-left">Code</th>
            <th className="border px-2 py-1 text-left">Access</th>
            <th className="border px-2 py-1 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.code}>
              <td className="border px-2 py-1">{f.label}</td>
              <td className="border px-2 py-1 text-[11px] text-slate-500">{f.code}</td>
              <td className="border px-2 py-1 text-[11px]">
                {f.canRead && f.canWrite && 'Default R/W'}
                {f.canRead && !f.canWrite && 'Read only'}
                {!f.canRead && 'Hidden'}
              </td>
              <td className="border px-2 py-1 text-[11px]">
                <button className="rounded border px-2 py-0.5" onClick={() => setOpenFieldCode(f.code)}>
                  Edit access
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {openFieldCode && (
        <FieldAclDrawer tableCode={tableCode} fieldCode={openFieldCode} onClose={() => setOpenFieldCode(null)} />
      )}
    </div>
  );
};
