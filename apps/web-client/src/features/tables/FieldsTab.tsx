import { useOutletContext } from 'react-router-dom';
import type { TableMeta, AuthorizedFieldMeta } from './types';
import { useState, useMemo } from 'react';
import { FieldDrawer } from './FieldDrawer';
import { BulkFieldUpdateModal } from './BulkFieldUpdateModal';
import {
  Plus,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Link2,
  FileText,
  List,
  Eye,
  EyeOff,
  Pencil,
  ChevronRight,
  Filter,
  Clock,
  Timer,
  DollarSign,
  Percent,
  User,
  Users,
  Paperclip,
  Image,
  Music,
  Video,
  Mail,
  Phone,
  Globe,
  Wifi,
  Palette,
  Key,
  Shield,
  Fingerprint,
  Calculator,
  GitBranch,
  Code,
  Workflow,
  Languages,
  MapPin,
  Tag,
  Binary,
  Braces,
  Layers,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, NoResultsState } from '../../components/ui/EmptyState';

interface OutletCtx {
  meta: TableMeta;
  refetch: () => void;
}

// Comprehensive field type configuration with icons and colors
const fieldTypeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  // Text types
  string: { icon: <Type className="h-4 w-4" />, color: 'var(--hw-primary)' },
  text: { icon: <FileText className="h-4 w-4" />, color: 'var(--hw-primary)' },
  rich_text: { icon: <FileText className="h-4 w-4" />, color: 'var(--hw-primary)' },

  // Numeric types
  integer: { icon: <Hash className="h-4 w-4" />, color: '#8b5cf6' },
  long: { icon: <Hash className="h-4 w-4" />, color: '#8b5cf6' },
  decimal: { icon: <Hash className="h-4 w-4" />, color: '#8b5cf6' },
  number: { icon: <Hash className="h-4 w-4" />, color: '#8b5cf6' },
  currency: { icon: <DollarSign className="h-4 w-4" />, color: '#8b5cf6' },
  percent: { icon: <Percent className="h-4 w-4" />, color: '#8b5cf6' },

  // Boolean
  boolean: { icon: <ToggleLeft className="h-4 w-4" />, color: '#f59e0b' },

  // Date & Time types
  date: { icon: <Calendar className="h-4 w-4" />, color: '#10b981' },
  datetime: { icon: <Calendar className="h-4 w-4" />, color: '#10b981' },
  timestamp: { icon: <Calendar className="h-4 w-4" />, color: '#10b981' },
  time: { icon: <Clock className="h-4 w-4" />, color: '#10b981' },
  duration: { icon: <Timer className="h-4 w-4" />, color: '#10b981' },

  // Choice types
  choice: { icon: <List className="h-4 w-4" />, color: '#06b6d4' },
  multi_choice: { icon: <List className="h-4 w-4" />, color: '#06b6d4' },
  tags: { icon: <Tag className="h-4 w-4" />, color: '#06b6d4' },
  enum: { icon: <List className="h-4 w-4" />, color: '#06b6d4' },

  // Reference types
  reference: { icon: <Link2 className="h-4 w-4" />, color: '#ec4899' },
  multi_reference: { icon: <Link2 className="h-4 w-4" />, color: '#ec4899' },
  user_reference: { icon: <User className="h-4 w-4" />, color: '#ec4899' },
  group_reference: { icon: <Users className="h-4 w-4" />, color: '#ec4899' },

  // Media types
  file: { icon: <Paperclip className="h-4 w-4" />, color: '#f97316' },
  image: { icon: <Image className="h-4 w-4" />, color: '#f97316' },
  audio: { icon: <Music className="h-4 w-4" />, color: '#f97316' },
  video: { icon: <Video className="h-4 w-4" />, color: '#f97316' },

  // Communication types
  email: { icon: <Mail className="h-4 w-4" />, color: '#3b82f6' },
  phone: { icon: <Phone className="h-4 w-4" />, color: '#3b82f6' },
  url: { icon: <Globe className="h-4 w-4" />, color: '#3b82f6' },
  ip_address: { icon: <Wifi className="h-4 w-4" />, color: '#3b82f6' },
  color: { icon: <Palette className="h-4 w-4" />, color: '#3b82f6' },

  // Structured types
  json: { icon: <Braces className="h-4 w-4" />, color: '#6366f1' },
  key_value: { icon: <Braces className="h-4 w-4" />, color: '#6366f1' },

  // Identity types
  auto_number: { icon: <Binary className="h-4 w-4" />, color: '#14b8a6' },
  guid: { icon: <Fingerprint className="h-4 w-4" />, color: '#14b8a6' },
  uuid: { icon: <Fingerprint className="h-4 w-4" />, color: '#14b8a6' },

  // Security types
  password_hashed: { icon: <Key className="h-4 w-4" />, color: '#ef4444' },
  secret_encrypted: { icon: <Shield className="h-4 w-4" />, color: '#ef4444' },
  domain_scope: { icon: <Shield className="h-4 w-4" />, color: '#ef4444' },

  // Computed types
  formula: { icon: <Calculator className="h-4 w-4" />, color: '#a855f7' },
  condition: { icon: <GitBranch className="h-4 w-4" />, color: '#a855f7' },
  script_ref: { icon: <Code className="h-4 w-4" />, color: '#a855f7' },

  // Workflow type
  workflow_stage: { icon: <Workflow className="h-4 w-4" />, color: '#84cc16' },

  // Localization types
  translated_string: { icon: <Languages className="h-4 w-4" />, color: '#0ea5e9' },
  translated_rich_text: { icon: <Languages className="h-4 w-4" />, color: '#0ea5e9' },

  // Location types
  geo_point: { icon: <MapPin className="h-4 w-4" />, color: '#22c55e' },
  location_reference: { icon: <MapPin className="h-4 w-4" />, color: '#22c55e' },
};

const getFieldTypeIcon = (type: string) => {
  const normalizedType = type.toLowerCase();
  return fieldTypeConfig[normalizedType]?.icon || <Type className="h-4 w-4" />;
};

const getFieldTypeColor = (type: string): string => {
  const normalizedType = type.toLowerCase();
  return fieldTypeConfig[normalizedType]?.color || 'var(--hw-text-muted)';
};

export const FieldsTab: React.FC = () => {
  const { meta, refetch } = useOutletContext<OutletCtx>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openField, setOpenField] = useState<AuthorizedFieldMeta | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);

  // Get unique field types for filter
  const fieldTypes = useMemo(() => {
    const types = new Set(meta.fields.map((f) => f.type.toLowerCase()));
    return Array.from(types).sort();
  }, [meta.fields]);

  // Filter and sort fields
  const filteredFields = useMemo(() => {
    let result = [...meta.fields];

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          f.type.toLowerCase().includes(q)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter((f) => f.type.toLowerCase() === filterType);
    }

    // Sort by label
    result.sort((a, b) => a.label.localeCompare(b.label));

    return result;
  }, [meta.fields, search, filterType]);

  const stats = useMemo(() => ({
    total: meta.fields.length,
    system: meta.fields.filter((f) => f.isSystem).length,
    visible: meta.fields.filter((f) => f.showInLists || f.showInForms).length,
  }), [meta.fields]);

  const handleCreateField = () => {
    setOpenField(null);
    setMode('create');
    setDrawerOpen(true);
  };

  const handleEditField = (field: AuthorizedFieldMeta) => {
    setOpenField(field);
    setMode('edit');
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setOpenField(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--hw-text)' }}>
            Fields
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
            Define the data structure and behavior for this table
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setBulkUpdateOpen(true)}
            leftIcon={<Layers className="h-4 w-4" />}
            disabled={meta.fields.filter(f => !f.isSystem && f.canWrite).length === 0}
          >
            Bulk Update
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateField}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Field
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="default" padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.total}</p>
            <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>Total Fields</p>
          </div>
        </Card>
        <Card variant="default" padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.visible}</p>
            <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>Visible</p>
          </div>
        </Card>
        <Card variant="default" padding="sm">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--hw-text)' }}>{stats.system}</p>
            <p className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>System</p>
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            showSearch
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border-0"
            style={{
              backgroundColor: 'var(--hw-bg-subtle)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="all">All types</option>
            {fieldTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fields List */}
      {meta.fields.length === 0 ? (
        <EmptyState
          icon={Type}
          title="No fields defined"
          description="Fields define the structure of your data. Add your first field to start building your table schema."
          actionLabel="Add Field"
          onAction={handleCreateField}
          variant="create"
        />
      ) : filteredFields.length === 0 ? (
        <NoResultsState
          query={search}
          onClear={() => {
            setSearch('');
            setFilterType('all');
          }}
        />
      ) : (
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="divide-y" style={{ borderColor: 'var(--hw-border-subtle)' }}>
            {filteredFields.map((field) => (
              <FieldRow
                key={field.code}
                field={field}
                onClick={() => handleEditField(field)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Field Drawer */}
      <FieldDrawer
        open={drawerOpen}
        mode={mode}
        tableCode={meta.table.code}
        field={openField}
        onClose={handleCloseDrawer}
        onSaved={refetch}
      />

      {/* Bulk Update Modal */}
      <BulkFieldUpdateModal
        open={bulkUpdateOpen}
        tableCode={meta.table.code}
        fields={meta.fields}
        onClose={() => setBulkUpdateOpen(false)}
        onUpdated={refetch}
      />
    </div>
  );
};

interface FieldRowProps {
  field: AuthorizedFieldMeta;
  onClick: () => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, onClick }) => {
  const typeColor = getFieldTypeColor(field.type);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      {/* Type Icon */}
      <div
        className="p-2 rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${typeColor}15` }}
      >
        <div style={{ color: typeColor }}>
          {getFieldTypeIcon(field.type)}
        </div>
      </div>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate" style={{ color: 'var(--hw-text)' }}>
            {field.label}
          </span>
          {field.isSystem && (
            <Badge variant="warning" size="sm">System</Badge>
          )}
          {field.isInternal && (
            <Badge variant="danger" size="sm">Internal</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <code
            className="text-xs"
            style={{ color: 'var(--hw-text-muted)' }}
          >
            {field.code}
          </code>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
          >
            {field.type}
          </span>
        </div>
      </div>

      {/* Visibility Flags */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: field.showInLists ? 'var(--hw-success-subtle, rgba(34, 197, 94, 0.1))' : 'var(--hw-bg-subtle)',
            color: field.showInLists ? 'var(--hw-success, #22c55e)' : 'var(--hw-text-muted)',
          }}
          title={field.showInLists ? 'Visible in lists' : 'Hidden in lists'}
        >
          <List className="h-3 w-3" />
          <span>List</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: field.showInForms ? 'var(--hw-success-subtle, rgba(34, 197, 94, 0.1))' : 'var(--hw-bg-subtle)',
            color: field.showInForms ? 'var(--hw-success, #22c55e)' : 'var(--hw-text-muted)',
          }}
          title={field.showInForms ? 'Visible in forms' : 'Hidden in forms'}
        >
          <FileText className="h-3 w-3" />
          <span>Form</span>
        </div>
      </div>

      {/* Access Badge */}
      <div className="flex-shrink-0">
        {field.canRead && field.canWrite && (
          <Badge variant="success" size="sm">
            <Pencil className="h-3 w-3 mr-1" />
            R/W
          </Badge>
        )}
        {field.canRead && !field.canWrite && (
          <Badge variant="primary" size="sm">
            <Eye className="h-3 w-3 mr-1" />
            Read
          </Badge>
        )}
        {!field.canRead && (
          <Badge variant="neutral" size="sm">
            <EyeOff className="h-3 w-3 mr-1" />
            Hidden
          </Badge>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className="h-4 w-4 flex-shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
        style={{ color: 'var(--hw-text-muted)' }}
      />
    </div>
  );
};

export default FieldsTab;
