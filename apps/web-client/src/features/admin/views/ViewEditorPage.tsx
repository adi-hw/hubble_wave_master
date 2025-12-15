import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Table,
  Kanban,
  Calendar,
  GanttChart,
  LayoutGrid,
  GitBranch,
  Star,
  User,
  Users,
  Plus,
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Settings,
  Filter,
} from 'lucide-react';
import metadataApi from '../../../services/metadataApi';

interface ViewDefinition {
  id: string;
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  viewType: 'list' | 'board' | 'calendar' | 'timeline' | 'card' | 'hierarchy';
  isDefault: boolean;
  isSystem: boolean;
  isPersonal: boolean;
  ownerId?: string;
  roleIds: string[];
  conditions: FilterCondition[];
  sortConfig: SortConfig[];
  groupBy?: string;
  pageSize: number;
  quickFilters: QuickFilter[];
  rowActions: RowAction[];
  bulkActions: RowAction[];
  boardConfig?: BoardConfig;
  calendarConfig?: CalendarConfig;
  timelineConfig?: TimelineConfig;
  sortOrder: number;
}

interface ViewColumn {
  id?: string;
  viewId?: string;
  propertyId?: string;
  propertyCode?: string;
  label?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  isVisible: boolean;
  isSortable: boolean;
  isFilterable: boolean;
  isResizable: boolean;
  isFrozen: boolean;
  isPinnedLeft: boolean;
  isPinnedRight: boolean;
  sortOrder: number;
  alignment: 'left' | 'center' | 'right';
  formatter?: string;
  formatterOptions: Record<string, unknown>;
  cellRenderer?: string;
  cellRendererOptions: Record<string, unknown>;
  headerTooltip?: string;
  aggregateFunction?: string;
  wrapText: boolean;
}

interface PropertyDefinition {
  id: string;
  code: string;
  label: string;
  propertyType: string;
  isRequired: boolean;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface QuickFilter {
  field: string;
  label: string;
  type: 'select' | 'search' | 'date' | 'boolean';
}

interface RowAction {
  code: string;
  label: string;
  icon?: string;
  type: 'primary' | 'secondary' | 'danger';
}

interface BoardConfig {
  groupByField: string;
  swimlaneField?: string;
  cardTitleField: string;
  cardDescriptionField?: string;
}

interface CalendarConfig {
  dateField: string;
  endDateField?: string;
  titleField: string;
  colorField?: string;
}

interface TimelineConfig {
  startField: string;
  endField: string;
  titleField: string;
  groupField?: string;
}

const viewTypeConfig = {
  list: { icon: Table, label: 'List', description: 'Traditional table view with sortable columns' },
  board: { icon: Kanban, label: 'Board', description: 'Kanban-style board with drag-and-drop cards' },
  calendar: { icon: Calendar, label: 'Calendar', description: 'Calendar view for date-based records' },
  timeline: { icon: GanttChart, label: 'Timeline', description: 'Gantt-style timeline for scheduled items' },
  card: { icon: LayoutGrid, label: 'Card', description: 'Grid of cards for visual browsing' },
  hierarchy: { icon: GitBranch, label: 'Hierarchy', description: 'Tree view for hierarchical data' },
};

const defaultView: Partial<ViewDefinition> = {
  viewType: 'list',
  isDefault: false,
  isPersonal: false,
  roleIds: [],
  conditions: [],
  sortConfig: [],
  pageSize: 20,
  quickFilters: [],
  rowActions: [],
  bulkActions: [],
  sortOrder: 0,
};

const defaultColumn: Partial<ViewColumn> = {
  isVisible: true,
  isSortable: true,
  isFilterable: true,
  isResizable: true,
  isFrozen: false,
  isPinnedLeft: false,
  isPinnedRight: false,
  alignment: 'left',
  formatterOptions: {},
  cellRendererOptions: {},
  wrapText: false,
};

export function ViewEditorPage() {
  const { collectionId, viewId } = useParams<{ collectionId: string; viewId: string }>();
  const navigate = useNavigate();
  const isNew = viewId === 'new';

  const [view, setView] = useState<Partial<ViewDefinition>>(defaultView);
  const [columns, setColumns] = useState<ViewColumn[]>([]);
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'columns' | 'filters' | 'config'>('general');

  useEffect(() => {
    loadData();
  }, [collectionId, viewId]);

  async function loadData() {
    try {
      setLoading(true);
      const propertiesRes = await metadataApi.get<PropertyDefinition[] | { data: PropertyDefinition[] }>(`/properties/collection/${collectionId}`);
      // Handle both array and wrapped response
      const propertiesData = Array.isArray(propertiesRes.data) ? propertiesRes.data : (propertiesRes.data?.data ?? []);
      setProperties(propertiesData);

      if (!isNew && viewId) {
        const viewRes = await metadataApi.get<(ViewDefinition & { columns?: ViewColumn[] }) | { data: ViewDefinition & { columns?: ViewColumn[] } }>(`/views/${viewId}/full`);
        const viewData = viewRes.data && 'columns' in viewRes.data ? viewRes.data : (viewRes.data as any)?.data;
        setView(viewData);
        setColumns(viewData.columns || []);
      } else {
        setView({ ...defaultView, collectionId });
        // Auto-populate columns from properties
        const defaultColumns: ViewColumn[] = propertiesData.slice(0, 10).map((p: PropertyDefinition, idx: number) => ({
          id: '',
          viewId: '',
          propertyId: p.id,
          propertyCode: p.code,
          label: p.label,
          sortOrder: idx * 10,
          isVisible: true,
          isSortable: true,
          isFilterable: true,
          isResizable: true,
          isFrozen: false,
          isPinnedLeft: false,
          isPinnedRight: false,
          alignment: 'left' as const,
          formatterOptions: {},
          cellRendererOptions: {},
          wrapText: false,
        }));
        setColumns(defaultColumns);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!view.code?.trim() || !view.label?.trim()) {
      setError('Code and label are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let savedView: ViewDefinition;
      if (isNew) {
        const res = await metadataApi.post<ViewDefinition>('/views', { ...view, collectionId });
        savedView = res.data;
      } else {
        const res = await metadataApi.put<ViewDefinition>(`/views/${viewId}`, view);
        savedView = res.data;
      }

      // Save columns
      await metadataApi.put(`/views/${savedView.id}/columns`, columns);

      navigate(`/studio/collections/${collectionId}/views`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleAddColumn() {
    const unusedProperties = properties.filter(
      (p) => !columns.some((c) => c.propertyCode === p.code)
    );
    if (unusedProperties.length === 0) return;

    const prop = unusedProperties[0];
    setColumns([
      ...columns,
      {
        ...defaultColumn,
        propertyId: prop.id,
        propertyCode: prop.code,
        label: prop.label,
        sortOrder: columns.length * 10,
      } as ViewColumn,
    ]);
  }

  function handleRemoveColumn(index: number) {
    setColumns(columns.filter((_, i) => i !== index));
  }

  function handleMoveColumn(index: number, direction: 'up' | 'down') {
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    newColumns.forEach((col, i) => (col.sortOrder = i * 10));
    setColumns(newColumns);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/studio/collections/${collectionId}/views`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {isNew ? 'New View' : `Edit ${view.label}`}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure how records are displayed
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save View'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'columns', label: 'Columns', icon: Table },
            { id: 'filters', label: 'Filters & Sorting', icon: Filter },
            { id: 'config', label: 'Type Config', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'general' && (
          <GeneralTab view={view} setView={setView} isNew={isNew} />
        )}
        {activeTab === 'columns' && (
          <ColumnsTab
            columns={columns}
            properties={properties}
            onAdd={handleAddColumn}
            onRemove={handleRemoveColumn}
            onMove={handleMoveColumn}
            onUpdate={(index, updates) => {
              const newColumns = [...columns];
              newColumns[index] = { ...newColumns[index], ...updates };
              setColumns(newColumns);
            }}
          />
        )}
        {activeTab === 'filters' && (
          <FiltersTab view={view} setView={setView} properties={properties} />
        )}
        {activeTab === 'config' && (
          <TypeConfigTab view={view} setView={setView} properties={properties} />
        )}
      </div>
    </div>
  );
}

interface GeneralTabProps {
  view: Partial<ViewDefinition>;
  setView: (v: Partial<ViewDefinition>) => void;
  isNew: boolean;
}

function GeneralTab({ view, setView, isNew }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* View Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          View Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(viewTypeConfig).map(([type, config]) => {
            const Icon = config.icon;
            const selected = view.viewType === type;
            return (
              <button
                key={type}
                onClick={() => setView({ ...view, viewType: type as any })}
                disabled={!isNew}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${!isNew && !selected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-6 h-6 mb-2 ${selected ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div className={`font-medium ${selected ? 'text-indigo-600' : 'text-gray-900 dark:text-white'}`}>
                  {config.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {config.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={view.code || ''}
            onChange={(e) => setView({ ...view, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
            disabled={!isNew}
            placeholder="my_view"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={view.label || ''}
            onChange={(e) => setView({ ...view, label: e.target.value })}
            placeholder="My View"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={view.description || ''}
          onChange={(e) => setView({ ...view, description: e.target.value })}
          rows={3}
          placeholder="Describe what this view shows..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Visibility */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Visibility</h3>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={!view.isPersonal}
              onChange={() => setView({ ...view, isPersonal: false })}
              className="w-4 h-4 text-indigo-600"
            />
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Shared with team</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={view.isPersonal}
              onChange={() => setView({ ...view, isPersonal: true })}
              className="w-4 h-4 text-indigo-600"
            />
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Personal (only me)</span>
          </label>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={view.isDefault}
            onChange={(e) => setView({ ...view, isDefault: e.target.checked })}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Set as default view for this type
          </span>
        </label>
      </div>

      {/* Page Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Page Size
        </label>
        <select
          value={view.pageSize || 20}
          onChange={(e) => setView({ ...view, pageSize: parseInt(e.target.value) })}
          className="w-40 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {[10, 20, 50, 100, 200].map((size) => (
            <option key={size} value={size}>
              {size} records
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

interface ColumnsTabProps {
  columns: ViewColumn[];
  properties: PropertyDefinition[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onUpdate: (index: number, updates: Partial<ViewColumn>) => void;
}

function ColumnsTab({ columns, properties, onAdd, onRemove, onMove, onUpdate }: ColumnsTabProps) {
  const unusedProperties = properties.filter(
    (p) => !columns.some((c) => c.propertyCode === p.code)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure which columns appear and their display settings
        </p>
        <button
          onClick={onAdd}
          disabled={unusedProperties.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Width</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Visible</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sortable</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Filterable</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {columns.map((column, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-2">
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={column.propertyCode || ''}
                    onChange={(e) => {
                      const prop = properties.find((p) => p.code === e.target.value);
                      onUpdate(index, {
                        propertyCode: e.target.value,
                        propertyId: prop?.id,
                        label: prop?.label || column.label,
                      });
                    }}
                    className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">Select field...</option>
                    {properties.map((p) => (
                      <option
                        key={p.code}
                        value={p.code}
                        disabled={columns.some((c) => c.propertyCode === p.code && c !== column)}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={column.label || ''}
                    onChange={(e) => onUpdate(index, { label: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    value={column.width || ''}
                    onChange={(e) => onUpdate(index, { width: parseInt(e.target.value) || undefined })}
                    placeholder="Auto"
                    className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm text-center"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onUpdate(index, { isVisible: !column.isVisible })}
                    className={`p-1 rounded ${column.isVisible ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {column.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={column.isSortable}
                    onChange={(e) => onUpdate(index, { isSortable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={column.isFilterable}
                    onChange={(e) => onUpdate(index, { isFilterable: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => onMove(index, 'down')}
                      disabled={index === columns.length - 1}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => onRemove(index)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {columns.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No columns configured. Click "Add Column" to start.
          </div>
        )}
      </div>
    </div>
  );
}

interface FiltersTabProps {
  view: Partial<ViewDefinition>;
  setView: (v: Partial<ViewDefinition>) => void;
  properties: PropertyDefinition[];
}

function FiltersTab({ view, setView, properties }: FiltersTabProps) {
  const sortConfig = view.sortConfig || [];
  const conditions = view.conditions || [];

  return (
    <div className="space-y-6">
      {/* Default Sort */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Default Sort</h3>
        <div className="space-y-2">
          {sortConfig.map((sort, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={sort.field}
                onChange={(e) => {
                  const newSort = [...sortConfig];
                  newSort[index] = { ...sort, field: e.target.value };
                  setView({ ...view, sortConfig: newSort });
                }}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="">Select field...</option>
                {properties.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={sort.direction}
                onChange={(e) => {
                  const newSort = [...sortConfig];
                  newSort[index] = { ...sort, direction: e.target.value as 'asc' | 'desc' };
                  setView({ ...view, sortConfig: newSort });
                }}
                className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <button
                onClick={() => {
                  setView({ ...view, sortConfig: sortConfig.filter((_, i) => i !== index) });
                }}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setView({ ...view, sortConfig: [...sortConfig, { field: '', direction: 'asc' }] });
            }}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add sort field
          </button>
        </div>
      </div>

      {/* Group By */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Group By
        </label>
        <select
          value={view.groupBy || ''}
          onChange={(e) => setView({ ...view, groupBy: e.target.value || undefined })}
          className="w-64 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="">No grouping</option>
          {properties.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Default Filters */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Default Filters</h3>
        <div className="space-y-2">
          {conditions.map((cond, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={cond.field}
                onChange={(e) => {
                  const newCond = [...conditions];
                  newCond[index] = { ...cond, field: e.target.value };
                  setView({ ...view, conditions: newCond });
                }}
                className="w-40 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="">Select field...</option>
                {properties.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => {
                  const newCond = [...conditions];
                  newCond[index] = { ...cond, operator: e.target.value };
                  setView({ ...view, conditions: newCond });
                }}
                className="w-32 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="starts_with">Starts With</option>
                <option value="ends_with">Ends With</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="is_null">Is Empty</option>
                <option value="is_not_null">Is Not Empty</option>
              </select>
              <input
                type="text"
                value={String(cond.value || '')}
                onChange={(e) => {
                  const newCond = [...conditions];
                  newCond[index] = { ...cond, value: e.target.value };
                  setView({ ...view, conditions: newCond });
                }}
                placeholder="Value..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <button
                onClick={() => {
                  setView({ ...view, conditions: conditions.filter((_, i) => i !== index) });
                }}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setView({
                ...view,
                conditions: [...conditions, { field: '', operator: 'equals', value: '' }],
              });
            }}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add filter condition
          </button>
        </div>
      </div>
    </div>
  );
}

interface TypeConfigTabProps {
  view: Partial<ViewDefinition>;
  setView: (v: Partial<ViewDefinition>) => void;
  properties: PropertyDefinition[];
}

function TypeConfigTab({ view, setView, properties }: TypeConfigTabProps) {
  if (view.viewType === 'board') {
    const config = view.boardConfig || { groupByField: '', cardTitleField: '' };
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Board Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group By Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.groupByField}
              onChange={(e) =>
                setView({ ...view, boardConfig: { ...config, groupByField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Card Title Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.cardTitleField}
              onChange={(e) =>
                setView({ ...view, boardConfig: { ...config, cardTitleField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Swimlane Field
            </label>
            <select
              value={config.swimlaneField || ''}
              onChange={(e) =>
                setView({
                  ...view,
                  boardConfig: { ...config, swimlaneField: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Card Description Field
            </label>
            <select
              value={config.cardDescriptionField || ''}
              onChange={(e) =>
                setView({
                  ...view,
                  boardConfig: { ...config, cardDescriptionField: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (view.viewType === 'calendar') {
    const config = view.calendarConfig || { dateField: '', titleField: '' };
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Calendar Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.dateField}
              onChange={(e) =>
                setView({ ...view, calendarConfig: { ...config, dateField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.propertyType))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.titleField}
              onChange={(e) =>
                setView({ ...view, calendarConfig: { ...config, titleField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date Field
            </label>
            <select
              value={config.endDateField || ''}
              onChange={(e) =>
                setView({
                  ...view,
                  calendarConfig: { ...config, endDateField: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">None (single day events)</option>
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.propertyType))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color Field
            </label>
            <select
              value={config.colorField || ''}
              onChange={(e) =>
                setView({
                  ...view,
                  calendarConfig: { ...config, colorField: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Default color</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (view.viewType === 'timeline') {
    const config = view.timelineConfig || { startField: '', endField: '', titleField: '' };
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Timeline Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.startField}
              onChange={(e) =>
                setView({ ...view, timelineConfig: { ...config, startField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.propertyType))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.endField}
              onChange={(e) =>
                setView({ ...view, timelineConfig: { ...config, endField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.propertyType))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title Field <span className="text-red-500">*</span>
            </label>
            <select
              value={config.titleField}
              onChange={(e) =>
                setView({ ...view, timelineConfig: { ...config, titleField: e.target.value } })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group Field
            </label>
            <select
              value={config.groupField || ''}
              onChange={(e) =>
                setView({
                  ...view,
                  timelineConfig: { ...config, groupField: e.target.value || undefined },
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">No grouping</option>
              {properties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>No additional configuration needed for {viewTypeConfig[view.viewType || 'list'].label} views.</p>
      <p className="text-sm mt-2">Column configuration is available on the Columns tab.</p>
    </div>
  );
}
