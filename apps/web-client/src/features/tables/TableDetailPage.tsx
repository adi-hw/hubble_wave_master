import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { useTableMetadata } from './useTableMetadata';
import {
  ArrowLeft,
  Table2,
  Database,
  Columns3,
  Layout,
  Shield,
  BarChart3,
  RefreshCw,
  MoreHorizontal,
  Copy,
  Trash2,
  Download,
  Settings,
  List,
  FileEdit,
  TableProperties,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const TableDetailPage: React.FC = () => {
  const { tableCode } = useParams<{ tableCode: string }>();
  const navigate = useNavigate();
  const { meta, loading, error, refetch } = useTableMetadata(tableCode!);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Loading skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-slate-200 animate-pulse" />
          <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-10 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-10 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-10 w-24 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card variant="default" padding="lg" className="border-red-200 bg-red-50/50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-100">
              <Table2 className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-red-900">Failed to load table</h3>
              <p className="text-sm text-red-700 mt-1">
                Could not load metadata for table "{tableCode}". The table may not exist or you may not have permission to view it.
              </p>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.reload()}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/studio/tables')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Back to tables
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { table, fields } = meta;
  const base = `/studio/tables/${table.code}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
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
        <span style={{ color: 'var(--hw-text)' }}>{table.label}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: 'var(--hw-primary-subtle)' }}
          >
            <Table2 className="h-8 w-8" style={{ color: 'var(--hw-primary)' }} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>
                {table.label}
              </h1>
              <Badge variant="success" size="sm">Tenant</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>Code:</span>
                <code
                  className="text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-black/10 transition-colors"
                  style={{ backgroundColor: 'var(--hw-bg-subtle)', color: 'var(--hw-text-secondary)' }}
                  onClick={() => copyToClipboard(table.code)}
                  title="Click to copy"
                >
                  {table.code}
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" style={{ color: 'var(--hw-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                  {table.dbTableName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Columns3 className="h-3.5 w-3.5" style={{ color: 'var(--hw-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                  {fields.length} fields
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<List className="h-4 w-4" />}
            onClick={() => navigate(`/${table.code}.list`)}
          >
            Open List
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileEdit className="h-4 w-4" />}
            onClick={() => navigate(`/${table.code}.form`)}
          >
            New Record
          </Button>

          {/* Actions Dropdown */}
          <div className="relative" ref={actionsRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActionsOpen(!actionsOpen)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            {actionsOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border z-50 overflow-hidden"
                style={{
                  backgroundColor: 'var(--hw-bg)',
                  borderColor: 'var(--hw-border-subtle)',
                }}
              >
                <div className="py-1">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left"
                    style={{ color: 'var(--hw-text)' }}
                    onClick={() => {
                      copyToClipboard(table.code);
                      setActionsOpen(false);
                    }}
                  >
                    <Copy className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                    Copy Table Code
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left"
                    style={{ color: 'var(--hw-text)' }}
                    onClick={() => {
                      // TODO: Implement export
                      setActionsOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                    Export Schema
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left"
                    style={{ color: 'var(--hw-text)' }}
                    onClick={() => {
                      navigate(`/studio/tables/${table.code}/settings`);
                      setActionsOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                    Table Settings
                  </button>
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: 'var(--hw-border-subtle)' }}
                  />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors text-left"
                    style={{ color: '#ef4444' }}
                    onClick={() => {
                      // TODO: Implement delete with confirmation
                      setActionsOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Table
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--hw-border-subtle)' }}
      >
        <nav className="-mb-px flex gap-1">
          <TabLink to={`${base}/fields`} icon={<Columns3 className="h-4 w-4" />} label="Fields" />
          <TabLink to={`${base}/data`} icon={<TableProperties className="h-4 w-4" />} label="Data" />
          <TabLink to={`${base}/layouts`} icon={<Layout className="h-4 w-4" />} label="Layouts" />
          <TabLink to={`${base}/access`} icon={<Shield className="h-4 w-4" />} label="Access Control" />
          <TabLink to={`${base}/usage`} icon={<BarChart3 className="h-4 w-4" />} label="Usage" />
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        <Outlet context={{ meta, refetch }} />
      </div>
    </div>
  );
};

interface TabLinkProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
}

const TabLink: React.FC<TabLinkProps> = ({ to, label, icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-current'
          : 'border-transparent hover:border-slate-300'
      }`
    }
    style={({ isActive }) => ({
      color: isActive ? 'var(--hw-primary)' : 'var(--hw-text-muted)',
    })}
  >
    {icon}
    {label}
  </NavLink>
);

export default TableDetailPage;
