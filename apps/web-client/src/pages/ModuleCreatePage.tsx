import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '../layout/AppLayout';
import { DynamicForm } from '../components/form/DynamicForm';
import { createData, getTableMetadata } from '../services/platform.service';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

interface ModuleCreatePageProps {
  forcedCode?: string;
}

export const ModuleCreatePage: React.FC<ModuleCreatePageProps> = ({ forcedCode }) => {
  const { tableCode } = useParams<{ tableCode?: string }>();
  const code = forcedCode || tableCode || '';
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [tableLabel, setTableLabel] = useState<string>(code);

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

  // Generate breadcrumbs
  const breadcrumbs = useBreadcrumbs({ tableLabel });

  if (!code) {
    return (
      <AppLayout title="Module" subtitle="Create" activeNavKey="models">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Invalid module.</div>
      </AppLayout>
    );
  }

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    setError('');
    try {
      const created = await createData(code, data);
      if (created?.id) {
        navigate(`/${code}.form/${created.id}`);
      } else {
        navigate(-1);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create record');
    } finally {
      setSubmitting(false);
    }
  };

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

        {submitting && (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--text-brand)' }} />
            <span>Saving...</span>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <DynamicForm
            tableCode={code}
            tableLabel={tableLabel}
            recordLabel={`New ${tableLabel}`}
            onSubmit={handleSubmit}
            onBack={() => navigate(`/${code}.list`)}
            hideSubmit={submitting}
          />
        </div>
      </div>
    </AppLayout>
  );
};
