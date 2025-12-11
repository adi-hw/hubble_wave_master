import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listData, getTableMetadata, bulkUpdateRecords, bulkDeleteRecords } from '../services/platform.service';
import { AppLayout } from '../layout/AppLayout';
import { DynamicTable } from '../components/table/DynamicTable';
import { Loader2, AlertCircle } from 'lucide-react';
import { deriveTenantSlug } from '../services/token';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

interface ModuleListPageProps {
  forcedCode?: string;
}

export const ModuleListPage: React.FC<ModuleListPageProps> = ({ forcedCode }) => {
  const { tableCode } = useParams<{ tableCode: string }>();
  const navigate = useNavigate();
  const code = forcedCode || tableCode || '';
  const effectiveCode =
    code === 'tables'
      ? 'model_table'
      : code === 'assets'
        ? 'asset'
        : code;
  const hostSlug = deriveTenantSlug(window.location.hostname);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [tableLabel, setTableLabel] = useState<string>(code || '');

  const recordPath = useMemo(() => {
    const prefix = hostSlug ? '' : '';
    return `${prefix}/${effectiveCode}.form`;
  }, [effectiveCode, hostSlug]);

  const loadData = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const data = await listData(effectiveCode);
      setRows(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [code, effectiveCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!code) return;
    getTableMetadata(effectiveCode)
      .then((meta) => {
        if (meta?.table?.label) {
          setTableLabel(meta.table.label);
        } else {
          setTableLabel(code);
        }
      })
      .catch(() => setTableLabel(code));
  }, [code, effectiveCode]);

  // Bulk update handler
  const handleBulkUpdate = useCallback(async (
    selectedIds: (string | number)[],
    columnCode: string,
    newValue: any
  ) => {
    await bulkUpdateRecords(effectiveCode, selectedIds, { [columnCode]: newValue });
  }, [effectiveCode]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async (selectedIds: (string | number)[]) => {
    await bulkDeleteRecords(effectiveCode, selectedIds);
  }, [effectiveCode]);

  // Generate breadcrumbs
  const breadcrumbs = useBreadcrumbs({ tableLabel: tableLabel || code });

  if (!code) {
    return (
      <AppLayout title="Module" subtitle="List" activeNavKey="models">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-900">No module selected</p>
          <p className="text-xs text-slate-500 mt-1">Please select a module from the sidebar</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      activeNavKey="models"
      breadcrumbs={breadcrumbs}
      showHeader={false}
    >
      {/* Error Alert */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-danger-50 border border-danger-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-danger-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-danger-800">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="text-sm font-medium text-danger-600 hover:text-danger-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-3" />
          <p className="text-sm text-slate-600">Loading records...</p>
        </div>
      ) : (
        <DynamicTable
          tableCode={effectiveCode}
          tableLabel={tableLabel || code}
          data={rows}
          onRefresh={loadData}
          onCreateNew={() => navigate(`/${effectiveCode}.form`)}
          onRowClick={(row) => {
            const recordId =
              row?.id ?? row?.recordId ?? row?.attributes?.id ?? row?.attributes?.recordId;
            if (!recordId) return;
            navigate(`${recordPath}/${recordId}`);
          }}
          selectable={true}
          getRowId={(row) => row?.id ?? row?.recordId ?? row?.attributes?.id ?? row?.attributes?.recordId}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
        />
      )}
    </AppLayout>
  );
};
