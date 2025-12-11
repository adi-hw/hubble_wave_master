import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { listData, bulkUpdateRecords, bulkDeleteRecords } from '../../services/platform.service';
import { DynamicTable } from '../../components/table/DynamicTable';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface TableMeta {
  table: {
    code: string;
    label: string;
    dbTableName: string;
  };
  fields: any[];
}

interface OutletCtx {
  meta: TableMeta;
  refetch: () => void;
}

export const DataTab: React.FC = () => {
  const { meta } = useOutletContext<OutletCtx>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const tableCode = meta.table.code;
  const tableLabel = meta.table.label;

  const loadData = useCallback(async () => {
    if (!tableCode) return;
    setLoading(true);
    setError('');
    try {
      const data = await listData(tableCode);
      setRows(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [tableCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bulk update handler
  const handleBulkUpdate = useCallback(async (
    selectedIds: (string | number)[],
    columnCode: string,
    newValue: any
  ) => {
    await bulkUpdateRecords(tableCode, selectedIds, { [columnCode]: newValue });
    loadData();
  }, [tableCode, loadData]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async (selectedIds: (string | number)[]) => {
    await bulkDeleteRecords(tableCode, selectedIds);
    loadData();
  }, [tableCode, loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-3" />
        <p className="text-sm text-slate-600">Loading records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm font-medium text-slate-900">Failed to load data</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={loadData}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <DynamicTable
      tableCode={tableCode}
      tableLabel={tableLabel}
      data={rows}
      onRefresh={loadData}
      onCreateNew={() => navigate(`/${tableCode}.form`)}
      onRowClick={(row) => {
        const recordId =
          row?.id ?? row?.recordId ?? row?.attributes?.id ?? row?.attributes?.recordId;
        if (!recordId) return;
        navigate(`/${tableCode}.form/${recordId}`);
      }}
      selectable={true}
      getRowId={(row) => row?.id ?? row?.recordId ?? row?.attributes?.id ?? row?.attributes?.recordId}
      onBulkUpdate={handleBulkUpdate}
      onBulkDelete={handleBulkDelete}
    />
  );
};

export default DataTab;
