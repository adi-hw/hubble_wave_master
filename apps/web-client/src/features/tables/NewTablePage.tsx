import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '../../services/api';
import {
  ArrowLeft,
  Table2,
  Database,
  Plus,
  User,
  GitBranch,
  Building,
  Tag,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

interface TableOptions {
  enableOwnership: boolean;
  enableOptimisticLocking: boolean;
  enableOrganization: boolean;
  enableTags: boolean;
}

export const NewTablePage: React.FC = () => {
  const navigate = useNavigate();
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<TableOptions>({
    enableOwnership: false,
    enableOptimisticLocking: false,
    enableOrganization: false,
    enableTags: false,
  });

  const onLabelChange = (value: string) => {
    setLabel(value);
    // Auto-generate code from label
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    setCode(slug);
  };

  const handleCreate = async () => {
    if (!label.trim()) {
      setError('Table label is required');
      return;
    }
    if (!code.trim()) {
      setError('Table code is required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      setError('Code must start with a letter and contain only lowercase letters, numbers, and underscores');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await metadataApi.post('/studio/tables', {
        label,
        code,
        description,
        options,
      });
      navigate(`/studio/tables/${code}/fields`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/studio/tables')}
          className="flex items-center gap-1.5 hover:underline"
          style={{ color: 'var(--hw-text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Tables
        </button>
        <span style={{ color: 'var(--hw-text-muted)' }}>/</span>
        <span style={{ color: 'var(--hw-text)' }}>New Table</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="p-3 rounded-xl"
          style={{ backgroundColor: 'var(--hw-primary-subtle)' }}
        >
          <Table2 className="h-8 w-8" style={{ color: 'var(--hw-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>
            Create New Table
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            Define a new data table for your application
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card variant="default" padding="md" className="border-red-200 bg-red-50/50">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* Form */}
      <Card variant="default" padding="lg">
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
              Basic Information
            </h3>

            <Input
              label="Table Label"
              placeholder="e.g., Work Orders"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              hint="The display name shown in the UI"
            />

            <Input
              label="Table Code"
              placeholder="e.g., work_orders"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hint="Used as the table identifier in APIs and database"
              leftIcon={<Database className="h-4 w-4" />}
            />

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--hw-text-secondary)' }}
              >
                Description
              </label>
              <textarea
                placeholder="Describe what this table is used for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{
                  backgroundColor: 'var(--hw-bg)',
                  borderColor: 'var(--hw-border)',
                  color: 'var(--hw-text)',
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Default System Columns Info */}
      <Card variant="default" padding="md">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <Info className="h-5 w-5" style={{ color: '#3b82f6' }} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--hw-text)' }}>
              Default System Columns
            </h4>
            <p className="text-xs mb-3" style={{ color: 'var(--hw-text-muted)' }}>
              Every table automatically includes these system columns for auditing and data management:
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" size="sm">id</Badge>
              <Badge variant="neutral" size="sm">created_at</Badge>
              <Badge variant="neutral" size="sm">created_by</Badge>
              <Badge variant="neutral" size="sm">updated_at</Badge>
              <Badge variant="neutral" size="sm">updated_by</Badge>
              <Badge variant="neutral" size="sm">is_active</Badge>
              <Badge variant="neutral" size="sm">deleted_at</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Advanced Options */}
      <Card variant="default" padding="lg">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--hw-text)' }}>
              Optional System Columns
            </h3>
            {(options.enableOwnership || options.enableOptimisticLocking || options.enableOrganization || options.enableTags) && (
              <Badge variant="primary" size="sm">
                {[options.enableOwnership, options.enableOptimisticLocking, options.enableOrganization, options.enableTags].filter(Boolean).length} selected
              </Badge>
            )}
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
          ) : (
            <ChevronDown className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-3">
            <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
              Enable additional system columns based on your requirements. These can be added later but are easier to set up during table creation.
            </p>

            {/* Ownership Option */}
            <label
              className={`
                flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${options.enableOwnership ? 'border-purple-500' : 'border-transparent hover:border-slate-200'}
              `}
              style={{
                backgroundColor: options.enableOwnership ? 'rgba(139, 92, 246, 0.05)' : 'var(--hw-bg-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={options.enableOwnership}
                onChange={(e) => setOptions({ ...options, enableOwnership: e.target.checked })}
                className="sr-only"
              />
              <div className="mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    options.enableOwnership ? 'bg-purple-600 border-purple-600' : 'border-slate-300 bg-white'
                  }`}
                >
                  {options.enableOwnership && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
              >
                <User className="h-5 w-5" style={{ color: '#8b5cf6' }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                  Record Ownership
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                  Adds <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">owner_id</code> column.
                  Enables ACL rules like "users can only edit their own records".
                </div>
              </div>
            </label>

            {/* Optimistic Locking Option */}
            <label
              className={`
                flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${options.enableOptimisticLocking ? 'border-amber-500' : 'border-transparent hover:border-slate-200'}
              `}
              style={{
                backgroundColor: options.enableOptimisticLocking ? 'rgba(245, 158, 11, 0.05)' : 'var(--hw-bg-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={options.enableOptimisticLocking}
                onChange={(e) => setOptions({ ...options, enableOptimisticLocking: e.target.checked })}
                className="sr-only"
              />
              <div className="mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    options.enableOptimisticLocking ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'
                  }`}
                >
                  {options.enableOptimisticLocking && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
              >
                <GitBranch className="h-5 w-5" style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                  Optimistic Locking
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                  Adds <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">row_version</code> column.
                  Prevents concurrent edit conflicts by tracking version numbers.
                </div>
              </div>
            </label>

            {/* Organization Option */}
            <label
              className={`
                flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${options.enableOrganization ? 'border-emerald-500' : 'border-transparent hover:border-slate-200'}
              `}
              style={{
                backgroundColor: options.enableOrganization ? 'rgba(16, 185, 129, 0.05)' : 'var(--hw-bg-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={options.enableOrganization}
                onChange={(e) => setOptions({ ...options, enableOrganization: e.target.checked })}
                className="sr-only"
              />
              <div className="mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    options.enableOrganization ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
                  }`}
                >
                  {options.enableOrganization && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <Building className="h-5 w-5" style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                  Organization Scope
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                  Adds <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">organization_id</code> column.
                  Useful for enterprises with multiple departments or org units.
                </div>
              </div>
            </label>

            {/* Tags Option */}
            <label
              className={`
                flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${options.enableTags ? 'border-cyan-500' : 'border-transparent hover:border-slate-200'}
              `}
              style={{
                backgroundColor: options.enableTags ? 'rgba(6, 182, 212, 0.05)' : 'var(--hw-bg-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={options.enableTags}
                onChange={(e) => setOptions({ ...options, enableTags: e.target.checked })}
                className="sr-only"
              />
              <div className="mt-0.5">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    options.enableTags ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300 bg-white'
                  }`}
                >
                  {options.enableTags && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div
                className="p-2 rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)' }}
              >
                <Tag className="h-5 w-5" style={{ color: '#06b6d4' }} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: 'var(--hw-text)' }}>
                  Tags
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                  Adds <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">tags</code> array column.
                  Enables flexible categorization and filtering without custom fields.
                </div>
              </div>
            </label>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/studio/tables')}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleCreate()}
          loading={saving}
          leftIcon={saving ? undefined : <Plus className="h-4 w-4" />}
        >
          Create Table
        </Button>
      </div>
    </div>
  );
};

export default NewTablePage;
