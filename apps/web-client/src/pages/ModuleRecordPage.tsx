import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '../layout/AppLayout';
import { DynamicForm } from '../components/form/DynamicForm';
import { getData, updateData, deleteData, getTableMetadata } from '../services/platform.service';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

interface ModuleRecordPageProps {
  forcedCode?: string;
}

export const ModuleRecordPage: React.FC<ModuleRecordPageProps> = ({ forcedCode }) => {
  const { tableCode, id } = useParams<{ tableCode?: string; id: string }>();
  const navigate = useNavigate();
  const code = forcedCode || tableCode;

  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [tableLabel, setTableLabel] = useState<string>(code || '');

  const recordLabel =
    record?.attributes?.label ||
    record?.attributes?.displayName ||
    record?.attributes?.name ||
    record?.label ||
    record?.displayName ||
    record?.name ||
    id;

  // Load record data
  const loadRecord = useCallback(async () => {
    if (!code || !id) return;

    setLoading(true);
    setError('');
    try {
      const data = await getData(code, id);
      setRecord(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  }, [code, id]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Load table metadata for breadcrumb label
  useEffect(() => {
    if (!code) return;
    getTableMetadata(code)
      .then((meta) => {
        if (meta?.table?.label) {
          setTableLabel(meta.table.label);
        }
      })
      .catch(() => {});
  }, [code]);

  // Handle form submission (update)
  const handleSubmit = async (data: Record<string, any>, goBack?: boolean) => {
    if (!code || !id) return;

    setError('');
    try {
      await updateData(code, id, data);
      if (goBack) {
        navigate(`/${code}.list`);
      } else {
        // Reload record to get updated data
        await loadRecord();
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save record');
      throw e;
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!code || !id) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this record? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await deleteData(code, id);
      navigate(`/${code}.list`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete record');
    }
  };

  // Generate breadcrumbs
  const breadcrumbs = useBreadcrumbs({ tableLabel, recordLabel });

  if (!code || !id) {
    return (
      <AppLayout title="Record" subtitle="Details" activeNavKey="models">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Invalid record reference.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      activeNavKey="models"
      breadcrumbs={breadcrumbs}
      showHeader={false}
    >
      <div className="space-y-4">
        {error && (
          <div
            className="text-sm rounded-lg px-4 py-3"
            style={{
              color: 'var(--text-danger)',
              backgroundColor: 'var(--bg-danger-subtle)',
              border: '1px solid var(--border-danger)',
            }}
          >
            {error}
          </div>
        )}

        {loading || !record ? (
          <div
            className="flex items-center justify-center gap-2 text-sm py-16"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-brand)' }} />
            <span>Loading record...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <DynamicForm
              tableCode={code}
              tableLabel={tableLabel}
              recordLabel={recordLabel}
              initialData={record}
              onSubmit={handleSubmit}
              onBack={() => navigate(`/${code}.list`)}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};
