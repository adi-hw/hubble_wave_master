import { useEffect, useState } from 'react';
import dataApi from '../../services/api';
import { useTableMetadata } from '../../hooks/useTableMetadata';

export const FormPage: React.FC<{ tableCode: string; recordId?: string }> = ({ tableCode, recordId }) => {
  const { meta, loading: metaLoading } = useTableMetadata(tableCode);
  const [record, setRecord] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const isNew = !recordId;

  useEffect(() => {
    const load = async () => {
      if (!meta) return;
      if (isNew) {
        setRecord({});
        setLoading(false);
        return;
      }

      setLoading(true);
      // Data CRUD operations go through svc-data service
      const res = await dataApi.get(`/data/${tableCode}/${recordId}`);
      setRecord(res.data.record);
      setLoading(false);
    };
    void load();
  }, [meta, tableCode, recordId, isNew]);

  if (metaLoading || loading) return <div>Loading...</div>;
  if (!meta) return <div>Missing metadata</div>;

  const formFields = meta.fields.filter((f) => f.showInForms && (f.canRead || f.canWrite));

  const handleChange = (code: string, value: any) => {
    setRecord((prev) => ({ ...prev, [code]: value }));
  };

  const handleSubmit = async () => {
    const payload: Record<string, any> = {};

    for (const f of formFields) {
      if (!f.canWrite) continue;
      payload[f.code] = record[f.code];
    }

    // Data CRUD operations go through svc-data service
    if (isNew) {
      await dataApi.post(`/data/${tableCode}`, { data: payload });
    } else {
      await dataApi.patch(`/data/${tableCode}/${recordId}`, { data: payload });
    }

    // TODO: redirect or show success toast
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{isNew ? `New ${meta.table.label}` : meta.table.label}</h1>

      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        {formFields.map((f) => {
          const value = record[f.code] ?? '';

          const readOnly = !f.canWrite;
          const masked = f.maskingStrategy !== 'NONE' && !f.canWrite;

          const displayValue = masked ? '********' : value;

          return (
            <div key={f.code} className="flex flex-col gap-1">
              <label htmlFor={`field-${f.code}`} className="text-xs font-medium text-gray-600">{f.label}</label>

              {readOnly ? (
                <div id={`field-${f.code}`} className="rounded border px-2 py-1 bg-gray-50 text-sm text-gray-700">{displayValue}</div>
              ) : (
                <input
                  id={`field-${f.code}`}
                  name={f.code}
                  autoComplete="off"
                  className="rounded border px-2 py-1 text-sm"
                  value={displayValue}
                  onChange={(e) => handleChange(f.code, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </form>
    </div>
  );
};
