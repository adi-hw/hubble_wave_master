/**
 * ViewConfigurator Component
 * HubbleWave Platform - Phase 2
 *
 * A comprehensive UI for configuring view settings including columns,
 * grouping, filtering, sorting, and view-type-specific options.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Filter,
  ArrowUpDown,
  Columns,
  Palette,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ViewConfig,
  ListViewConfig,
  KanbanViewConfig,
  CalendarViewConfig,
  PivotViewConfig,
  GanttViewConfig,
  MapViewConfig,
} from '../types';

interface Property {
  code: string;
  name: string;
  type: string;
}

interface ViewConfiguratorProps {
  view: ViewConfig;
  properties: Property[];
  onSave: (config: ViewConfig) => void;
  onCancel: () => void;
}

type ConfigSection = 'general' | 'columns' | 'grouping' | 'filters' | 'sorting' | 'appearance';

interface SortableColumnItemProps {
  property: Property;
  isVisible: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  property,
  isVisible,
  onToggle,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: property.code,
  });

  const transformStyle = transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 p-2 rounded-lg transition-transform ${isDragging ? 'opacity-50' : 'opacity-100'}`}
      {...attributes}
      {...(transformStyle && { style: { transform: transformStyle } })}
    >
      <button {...listeners} className="cursor-grab p-1 text-muted-foreground">
        <GripVertical size={16} />
      </button>
      <span className="flex-1 text-sm text-foreground">
        {property.name}
      </span>
      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
        {property.type}
      </span>
      <button
        onClick={onToggle}
        className={`p-1 rounded hover:bg-muted ${isVisible ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-muted text-destructive"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export const ViewConfigurator: React.FC<ViewConfiguratorProps> = ({
  view,
  properties,
  onSave,
  onCancel,
}) => {
  const [config, setConfig] = useState<ViewConfig>({ ...view });
  const [activeSection, setActiveSection] = useState<ConfigSection>('general');
  const [isDirty, setIsDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateConfig = useCallback((key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(config);
    setIsDirty(false);
  }, [config, onSave]);

  const handleReset = useCallback(() => {
    setConfig({ ...view });
    setIsDirty(false);
  }, [view]);

  const sections: { id: ConfigSection; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const baseSections = [
      { id: 'general' as const, label: 'General', icon: <Settings size={16} /> },
      { id: 'filters' as const, label: 'Filters', icon: <Filter size={16} /> },
      { id: 'sorting' as const, label: 'Sorting', icon: <ArrowUpDown size={16} /> },
    ];

    if (config.type === 'list') {
      return [
        ...baseSections.slice(0, 1),
        { id: 'columns' as const, label: 'Columns', icon: <Columns size={16} /> },
        ...baseSections.slice(1),
        { id: 'appearance' as const, label: 'Appearance', icon: <Palette size={16} /> },
      ];
    }

    if (config.type === 'kanban' || config.type === 'calendar' || config.type === 'timeline') {
      return [
        ...baseSections.slice(0, 1),
        { id: 'grouping' as const, label: 'Grouping', icon: <Columns size={16} /> },
        ...baseSections.slice(1),
        { id: 'appearance' as const, label: 'Appearance', icon: <Palette size={16} /> },
      ];
    }

    return [...baseSections, { id: 'appearance' as const, label: 'Appearance', icon: <Palette size={16} /> }];
  }, [config.type]);

  const renderGeneralSection = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-muted-foreground">
          View Name
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateConfig('name', e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.isDefault || false}
            onChange={(e) => updateConfig('isDefault', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">
            Default view
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.isPersonal || false}
            onChange={(e) => updateConfig('isPersonal', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">
            Personal view
          </span>
        </label>
      </div>
    </div>
  );

  const renderColumnsSection = () => {
    if (config.type !== 'list') return null;
    const listConfig = config as ListViewConfig;
    const columnCodes = new Set(listConfig.columns.map((c) => c.code));

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = listConfig.columns.findIndex((c) => c.code === active.id);
        const newIndex = listConfig.columns.findIndex((c) => c.code === over.id);
        const newColumns = arrayMove(listConfig.columns, oldIndex, newIndex);
        updateConfig('columns', newColumns);
      }
    };

    const addColumn = (propertyCode: string) => {
      const property = properties.find((p) => p.code === propertyCode);
      if (!property) return;
      const newColumn = {
        code: property.code,
        label: property.name,
        type: property.type,
        hidden: false,
        width: 150,
      };
      updateConfig('columns', [...listConfig.columns, newColumn]);
    };

    const removeColumn = (code: string) => {
      updateConfig(
        'columns',
        listConfig.columns.filter((c) => c.code !== code)
      );
    };

    const toggleColumnVisibility = (code: string) => {
      updateConfig(
        'columns',
        listConfig.columns.map((c) => (c.code === code ? { ...c, hidden: !c.hidden } : c))
      );
    };

    const availableProperties = properties.filter((p) => !columnCodes.has(p.code));

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Drag columns to reorder. Click the eye icon to show/hide.
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={listConfig.columns.map((c) => c.code)}
            strategy={verticalListSortingStrategy}
          >
            <div className="border rounded-lg divide-y border-border bg-muted">
              {listConfig.columns.map((column) => {
                const property = properties.find((p) => p.code === column.code);
                if (!property) return null;
                return (
                  <SortableColumnItem
                    key={column.code}
                    property={property}
                    isVisible={!column.hidden}
                    onToggle={() => toggleColumnVisibility(column.code)}
                    onRemove={() => removeColumn(column.code)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {availableProperties.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Add Column
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addColumn(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              <option value="">Select a property...</option>
              {availableProperties.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  const renderKanbanConfig = () => {
    if (config.type !== 'kanban') return null;
    const kanbanConfig = config as KanbanViewConfig;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Group By Property
          </label>
          <select
            value={kanbanConfig.groupByProperty}
            onChange={(e) => updateConfig('groupByProperty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            {properties
              .filter((p) => ['choice', 'multi_choice', 'reference', 'user'].includes(p.type))
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Card Title Property
          </label>
          <select
            value={kanbanConfig.titleProperty}
            onChange={(e) => updateConfig('titleProperty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={kanbanConfig.hideEmptyLanes || false}
              onChange={(e) => updateConfig('hideEmptyLanes', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Hide empty lanes
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={kanbanConfig.enableWipLimits || false}
              onChange={(e) => updateConfig('enableWipLimits', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Enable WIP limits
            </span>
          </label>
        </div>
      </div>
    );
  };

  const renderCalendarConfig = () => {
    if (config.type !== 'calendar') return null;
    const calendarConfig = config as CalendarViewConfig;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Event Title Property
          </label>
          <select
            value={calendarConfig.titleProperty}
            onChange={(e) => updateConfig('titleProperty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Start Date Property
            </label>
            <select
              value={calendarConfig.startDateProperty}
              onChange={(e) => updateConfig('startDateProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              End Date Property
            </label>
            <select
              value={calendarConfig.endDateProperty || ''}
              onChange={(e) => updateConfig('endDateProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              <option value="">None (single date)</option>
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Default View Mode
          </label>
          <select
            value={calendarConfig.defaultViewMode || 'month'}
            onChange={(e) => updateConfig('defaultViewMode', e.target.value as CalendarViewConfig['defaultViewMode'])}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
            <option value="agenda">Agenda</option>
          </select>
        </div>
      </div>
    );
  };

  const renderGanttConfig = () => {
    if (config.type !== 'gantt') return null;
    const ganttConfig = config as GanttViewConfig;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Task Title Property
          </label>
          <select
            value={ganttConfig.titleProperty}
            onChange={(e) => updateConfig('titleProperty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Start Date Property
            </label>
            <select
              value={ganttConfig.startDateProperty}
              onChange={(e) => updateConfig('startDateProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              End Date Property
            </label>
            <select
              value={ganttConfig.endDateProperty}
              onChange={(e) => updateConfig('endDateProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              {properties
                .filter((p) => ['date', 'datetime'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ganttConfig.showDependencies || false}
              onChange={(e) => updateConfig('showDependencies', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show dependencies
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ganttConfig.showProgress || false}
              onChange={(e) => updateConfig('showProgress', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show progress
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ganttConfig.showCriticalPath || false}
              onChange={(e) => updateConfig('showCriticalPath', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show critical path
            </span>
          </label>
        </div>
      </div>
    );
  };

  const renderMapConfig = () => {
    if (config.type !== 'map') return null;
    const mapConfig = config as MapViewConfig;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Marker Title Property
          </label>
          <select
            value={mapConfig.titleProperty}
            onChange={(e) => updateConfig('titleProperty', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            {properties.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Latitude Property
            </label>
            <select
              value={mapConfig.latitudeProperty}
              onChange={(e) => updateConfig('latitudeProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              {properties
                .filter((p) => ['decimal', 'integer', 'geolocation'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Longitude Property
            </label>
            <select
              value={mapConfig.longitudeProperty}
              onChange={(e) => updateConfig('longitudeProperty', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
            >
              {properties
                .filter((p) => ['decimal', 'integer', 'geolocation'].includes(p.type))
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mapConfig.clusterMarkers || false}
              onChange={(e) => updateConfig('clusterMarkers', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Cluster markers
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mapConfig.enableSearch || false}
              onChange={(e) => updateConfig('enableSearch', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Enable search
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Map Style
          </label>
          <select
            value={mapConfig.mapStyle || 'roadmap'}
            onChange={(e) => updateConfig('mapStyle', e.target.value as MapViewConfig['mapStyle'])}
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
          >
            <option value="roadmap">Roadmap</option>
            <option value="satellite">Satellite</option>
            <option value="terrain">Terrain</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>
    );
  };

  const renderPivotConfig = () => {
    if (config.type !== 'pivot') return null;
    const pivotConfig = config as PivotViewConfig;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Row Dimensions
          </label>
          <div className="border rounded-lg p-2 space-y-2 border-border bg-muted">
            {(pivotConfig.rows || []).map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={row.property}
                  onChange={(e) => {
                    const newRows = [...(pivotConfig.rows || [])];
                    newRows[index] = { ...row, property: e.target.value };
                    updateConfig('rows', newRows);
                  }}
                  className="flex-1 px-2 py-1 rounded text-sm bg-card border border-border text-foreground"
                >
                  {properties.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const newRows = pivotConfig.rows?.filter((_, i) => i !== index) || [];
                    updateConfig('rows', newRows);
                  }}
                  className="p-1 rounded hover:bg-muted text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newRows = [...(pivotConfig.rows || []), { property: properties[0]?.code || '' }];
                updateConfig('rows', newRows);
              }}
              className="flex items-center gap-1 text-sm px-2 py-1 rounded text-primary"
            >
              <Plus size={14} /> Add row
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Column Dimensions
          </label>
          <div className="border rounded-lg p-2 space-y-2 border-border bg-muted">
            {(pivotConfig.columns || []).map((col, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={col.property}
                  onChange={(e) => {
                    const newCols = [...(pivotConfig.columns || [])];
                    newCols[index] = { ...col, property: e.target.value };
                    updateConfig('columns', newCols);
                  }}
                  className="flex-1 px-2 py-1 rounded text-sm bg-card border border-border text-foreground"
                >
                  {properties.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const newCols = pivotConfig.columns?.filter((_, i) => i !== index) || [];
                    updateConfig('columns', newCols);
                  }}
                  className="p-1 rounded hover:bg-muted text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newCols = [...(pivotConfig.columns || []), { property: properties[0]?.code || '' }];
                updateConfig('columns', newCols);
              }}
              className="flex items-center gap-1 text-sm px-2 py-1 rounded text-primary"
            >
              <Plus size={14} /> Add column
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pivotConfig.showTotals || false}
              onChange={(e) => updateConfig('showTotals', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show totals
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pivotConfig.showSubtotals || false}
              onChange={(e) => updateConfig('showSubtotals', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show subtotals
            </span>
          </label>
        </div>
      </div>
    );
  };

  const renderSortingSection = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-muted-foreground">
          Sort By
        </label>
        <select
          value={config.sortBy || ''}
          onChange={(e) => updateConfig('sortBy', e.target.value || undefined)}
          className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border text-foreground"
        >
          <option value="">None</option>
          {properties.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {config.sortBy && (
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">
            Sort Direction
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => updateConfig('sortDir', 'asc')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border ${
                config.sortDir === 'asc'
                  ? 'ring-2 ring-primary bg-primary/10 text-primary'
                  : 'bg-muted text-foreground'
              }`}
            >
              Ascending (A-Z)
            </button>
            <button
              onClick={() => updateConfig('sortDir', 'desc')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border ${
                config.sortDir === 'desc'
                  ? 'ring-2 ring-primary bg-primary/10 text-primary'
                  : 'bg-muted text-foreground'
              }`}
            >
              Descending (Z-A)
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderFiltersSection = () => {
    const filters = (config.filters || []) as Array<{
      property: string;
      operator: string;
      value: string;
    }>;

    const operators = [
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does not contain' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
      { value: 'gt', label: 'Greater than' },
      { value: 'gte', label: 'Greater than or equal' },
      { value: 'lt', label: 'Less than' },
      { value: 'lte', label: 'Less than or equal' },
      { value: 'is_null', label: 'Is empty' },
      { value: 'is_not_null', label: 'Is not empty' },
    ];

    const addFilter = () => {
      const newFilters = [
        ...filters,
        { property: properties[0]?.code || '', operator: 'eq', value: '' },
      ];
      updateConfig('filters', newFilters);
    };

    const updateFilter = (index: number, field: string, value: string) => {
      const newFilters = filters.map((f, i) =>
        i === index ? { ...f, [field]: value } : f
      );
      updateConfig('filters', newFilters);
    };

    const removeFilter = (index: number) => {
      const newFilters = filters.filter((_, i) => i !== index);
      updateConfig('filters', newFilters);
    };

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Define default filters that apply when this view loads.
        </div>

        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
              <select
                value={filter.property}
                onChange={(e) => updateFilter(index, 'property', e.target.value)}
                className="flex-1 px-2 py-1.5 rounded text-sm bg-card border border-border text-foreground"
              >
                {properties.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={filter.operator}
                onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                className="w-40 px-2 py-1.5 rounded text-sm bg-card border border-border text-foreground"
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {!['is_null', 'is_not_null'].includes(filter.operator) && (
                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1.5 rounded text-sm bg-card border border-border text-foreground"
                />
              )}

              <button
                onClick={() => removeFilter(index)}
                className="p-1.5 rounded hover:bg-card text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addFilter}
          className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary"
        >
          <Plus size={14} /> Add filter
        </button>

        {filters.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">
              Filter Logic
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateConfig('filterLogic', 'and')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border ${
                  (config.filterLogic || 'and') === 'and'
                    ? 'ring-2 ring-primary bg-primary/10 text-primary'
                    : 'bg-muted text-foreground'
                }`}
              >
                Match ALL filters (AND)
              </button>
              <button
                onClick={() => updateConfig('filterLogic', 'or')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border ${
                  config.filterLogic === 'or'
                    ? 'ring-2 ring-primary bg-primary/10 text-primary'
                    : 'bg-muted text-foreground'
                }`}
              >
                Match ANY filter (OR)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAppearanceSection = () => {
    const appearance = (config.appearance || {}) as {
      density?: 'compact' | 'normal' | 'comfortable';
      showGridLines?: boolean;
      alternateRowColors?: boolean;
      headerStyle?: 'default' | 'bold' | 'colored';
      accentColor?: string;
    };

    const updateAppearance = (key: string, value: unknown) => {
      updateConfig('appearance', { ...appearance, [key]: value });
    };

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Row Density
          </label>
          <div className="flex gap-2">
            {(['compact', 'normal', 'comfortable'] as const).map((density) => (
              <button
                key={density}
                onClick={() => updateAppearance('density', density)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border capitalize ${
                  (appearance.density || 'normal') === density
                    ? 'ring-2 ring-primary bg-primary/10 text-primary'
                    : 'bg-muted text-foreground'
                }`}
              >
                {density}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Header Style
          </label>
          <div className="flex gap-2">
            {(['default', 'bold', 'colored'] as const).map((style) => (
              <button
                key={style}
                onClick={() => updateAppearance('headerStyle', style)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border border-border capitalize ${
                  (appearance.headerStyle || 'default') === style
                    ? 'ring-2 ring-primary bg-primary/10 text-primary'
                    : 'bg-muted text-foreground'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={appearance.showGridLines ?? true}
              onChange={(e) => updateAppearance('showGridLines', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Show grid lines
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={appearance.alternateRowColors ?? false}
              onChange={(e) => updateAppearance('alternateRowColors', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              Alternate row colors (zebra stripes)
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            Accent Color
          </label>
          <div className="flex gap-2">
            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
              <button
                key={color}
                onClick={() => updateAppearance('accentColor', color)}
                className={`w-8 h-8 rounded-lg border-2 ${
                  appearance.accentColor === color ? 'border-foreground' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={appearance.accentColor || '#3b82f6'}
              onChange={(e) => updateAppearance('accentColor', e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderGroupingSection = () => {
    switch (config.type) {
      case 'kanban':
        return renderKanbanConfig();
      case 'calendar':
        return renderCalendarConfig();
      case 'gantt':
        return renderGanttConfig();
      case 'map':
        return renderMapConfig();
      case 'pivot':
        return renderPivotConfig();
      default:
        return null;
    }
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection();
      case 'columns':
        return renderColumnsSection();
      case 'grouping':
        return renderGroupingSection();
      case 'filters':
        return renderFiltersSection();
      case 'sorting':
        return renderSortingSection();
      case 'appearance':
        return renderAppearanceSection();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
      <div className="w-full max-w-3xl max-h-[80vh] rounded-xl shadow-xl flex flex-col overflow-hidden bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Configure View
            </h2>
            <p className="text-sm text-muted-foreground">
              {config.type.charAt(0).toUpperCase() + config.type.slice(1)} View
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 py-4 border-r border-border bg-muted">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                  activeSection === section.id
                    ? 'font-medium bg-muted-foreground/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted-foreground/5'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">{renderActiveSection()}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50 bg-muted text-muted-foreground border border-border hover:bg-muted-foreground/10"
          >
            <RotateCcw size={16} />
            Reset
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm bg-muted text-muted-foreground border border-border hover:bg-muted-foreground/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewConfigurator;
