import { useEffect, useState } from 'react';
import dataApi from '../../services/api';
import { useTableMetadata } from '../../hooks/useTableMetadata';

export const TablePage: React.FC<{ tableCode: string }> = ({ tableCode }) => {
  const { meta, loading: metaLoading } = useTableMetadata(tableCode);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) return;
    const load = async () => {
      setLoading(true);
      // Data CRUD operations go through svc-data service
      const res = await dataApi.get(`/data/${tableCode}`);
      setRows(res.data.data ?? res.data.items ?? []);
      setLoading(false);
    };
    void load();
  }, [meta, tableCode]);

  if (metaLoading || loading) return <div>Loading...</div>;
  if (!meta) return <div>Missing metadata</div>;

  const listFields = meta.fields.filter((f) => f.showInLists && f.canRead);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{meta.table.label}</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {listFields.map((f) => (
              <th key={f.code} className="border px-2 py-1 text-left">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {listFields.map((f) => (
                <td key={f.code} className="border px-2 py-1">
                  {row[f.code] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
