import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createApiClient } from '../../services/api';
import type { TableMeta } from './types';
import { FieldAclSummary } from './FieldAclSummary';
import { AbacRulesDrawer } from './AbacRulesDrawer';
import {
  ShieldAlert,
  Plus,
  Save,
  Eye,
  Pencil,
  Trash2,
  Users,
  Key,
  Filter,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

interface AbacRule {
  id: string;
  name: string;
  condition: string;
  effect: 'ALLOW' | 'DENY';
  priority: number;
}

const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';
const metadataApi = createApiClient(METADATA_API_URL);

interface OutletCtx {
  meta: TableMeta;
}

type TableOperation = 'create' | 'read' | 'update' | 'delete';

interface TableAclRow {
  operation: TableOperation;
  requiredRoles: string[];
  requiredPermissions: string[];
  hasAbacRules: boolean;
  abacRules?: AbacRule[];
}

const operationConfig: Record<TableOperation, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  create: {
    icon: <Plus className="h-4 w-4" />,
    label: 'Create',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  read: {
    icon: <Eye className="h-4 w-4" />,
    label: 'Read',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  update: {
    icon: <Pencil className="h-4 w-4" />,
    label: 'Update',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  delete: {
    icon: <Trash2 className="h-4 w-4" />,
    label: 'Delete',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
};

export const AccessControlTab: React.FC = () => {
  const { meta } = useOutletContext<OutletCtx>();
  const [rows, setRows] = useState<TableAclRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abacDrawerOpen, setAbacDrawerOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<TableOperation | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await metadataApi.get(`/studio/tables/${meta.table.code}/acl`);
        setRows(res.data.operations || []);
      } catch {
        setError('Failed to load access control settings');
        setRows([
          { operation: 'create', requiredRoles: [], requiredPermissions: [], hasAbacRules: false },
          { operation: 'read', requiredRoles: [], requiredPermissions: [], hasAbacRules: false },
          { operation: 'update', requiredRoles: [], requiredPermissions: [], hasAbacRules: false },
          { operation: 'delete', requiredRoles: [], requiredPermissions: [], hasAbacRules: false },
        ]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [meta.table.code]);

  const handleRolesChange = (op: TableOperation, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.operation === op
          ? { ...row, requiredRoles: value.split(',').map((s) => s.trim()).filter(Boolean) }
          : row
      )
    );
  };

  const openAbacDrawer = (op: TableOperation) => {
    setSelectedOperation(op);
    setAbacDrawerOpen(true);
  };

  const handleAbacSave = (rules: AbacRule[]) => {
    if (!selectedOperation) return;
    setRows((prev) =>
      prev.map((row) =>
        row.operation === selectedOperation
          ? { ...row, abacRules: rules, hasAbacRules: rules.length > 0 }
          : row
      )
    );
  };

  const getSelectedRow = () => rows.find(r => r.operation === selectedOperation);

  const save = async () => {
    setSaving(true);
    try {
      await metadataApi.patch(`/studio/tables/${meta.table.code}/acl`, {
        operations: rows,
      });
    } catch {
      setError('Failed to save access control settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
            Access Control
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
            Control who can create, read, update, and delete records
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => void save()}
          loading={saving}
          leftIcon={<Save className="h-4 w-4" />}
        >
          Save Changes
        </Button>
      </div>

      {error && (
        <Card variant="default" padding="md" className="border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">{error}</span>
          </div>
        </Card>
      )}

      {/* Operations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((row) => {
          const config = operationConfig[row.operation];
          return (
            <Card key={row.operation} variant="default" padding="none" className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: config.bgColor }}
              >
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: 'white' }}
                >
                  <div style={{ color: config.color }}>{config.icon}</div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--hw-text)' }}>
                    {config.label}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                    {row.requiredRoles.length > 0 || row.requiredPermissions.length > 0
                      ? 'Restricted'
                      : 'Open to all authenticated users'}
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Roles */}
                <div>
                  <label
                    htmlFor={`acl-roles-${row.operation}`}
                    className="flex items-center gap-2 text-xs font-medium mb-2"
                    style={{ color: 'var(--hw-text-secondary)' }}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Required Roles
                  </label>
                  <Input
                    id={`acl-roles-${row.operation}`}
                    name={`roles-${row.operation}`}
                    autoComplete="off"
                    placeholder="e.g., asset_tech, tenant_admin"
                    value={row.requiredRoles.join(', ')}
                    onChange={(e) => handleRolesChange(row.operation, e.target.value)}
                  />
                  {row.requiredRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {row.requiredRoles.map((role) => (
                        <Badge key={role} variant="primary" size="sm">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permissions */}
                <div>
                  <div
                    className="flex items-center gap-2 text-xs font-medium mb-2"
                    style={{ color: 'var(--hw-text-secondary)' }}
                  >
                    <Key className="h-3.5 w-3.5" />
                    Required Permissions
                  </div>
                  {row.requiredPermissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.requiredPermissions.map((perm) => (
                        <Badge key={perm} variant="neutral" size="sm">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>
                      No specific permissions required
                    </p>
                  )}
                </div>

                {/* ABAC Rules */}
                <div
                  className="pt-3 border-t flex items-center justify-between"
                  style={{ borderColor: 'var(--hw-border-subtle)' }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: 'var(--hw-text-muted)' }}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>Conditional Rules (ABAC)</span>
                    </div>
                    {row.hasAbacRules && (
                      <Badge variant="primary" size="sm">
                        {row.abacRules?.length || 0} rules
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openAbacDrawer(row.operation)}
                  >
                    {row.hasAbacRules ? 'Edit Rules' : 'Add Rule'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Field-level ACL */}
      <div className="mt-4">
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--hw-text)' }}>
          Field-Level Access
        </h3>
        <FieldAclSummary tableCode={meta.table.code} fields={meta.fields} />
      </div>

      {/* ABAC Rules Drawer */}
      {selectedOperation && (
        <AbacRulesDrawer
          open={abacDrawerOpen}
          tableCode={meta.table.code}
          operation={selectedOperation}
          operationLabel={operationConfig[selectedOperation].label}
          operationColor={operationConfig[selectedOperation].color}
          onClose={() => {
            setAbacDrawerOpen(false);
            setSelectedOperation(null);
          }}
          onSave={handleAbacSave}
          initialRules={getSelectedRow()?.abacRules || []}
        />
      )}
    </div>
  );
};

export default AccessControlTab;
