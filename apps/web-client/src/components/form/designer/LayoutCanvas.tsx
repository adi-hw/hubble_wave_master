import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  Columns2,
  Columns3,
  Square,
  Type,
  Link2,
  Layers,
} from 'lucide-react';
import {
  DesignerTab,
  DesignerSection,
  DesignerItem,
  DesignerState,
} from './types';

interface LayoutCanvasProps {
  tab: DesignerTab;
  mode: 'edit' | 'preview';
  selectedItemId: string | null;
  onSelectItem: (id: string | null, type: DesignerState['selectedItemType']) => void;
  onAddSection: () => void;
  onRemoveItem: (id: string) => void;
  onRemoveSection: (id: string) => void;
  onUpdateSection: (id: string, updates: Partial<DesignerSection>) => void;
}

// Sortable Field Item Component
const SortableFieldItem: React.FC<{
  item: DesignerItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  mode: 'edit' | 'preview';
}> = ({ item, isSelected, onSelect, onRemove, mode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Get span class
  const getSpanClass = (span?: number) => {
    switch (span) {
      case 2: return 'col-span-2';
      case 3: return 'col-span-3';
      case 4: return 'col-span-4';
      default: return 'col-span-1';
    }
  };

  const renderItemContent = () => {
    switch (item.type) {
      case 'field':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getFieldTypeColor(item.fieldCode)}`}>
              {getFieldTypeIcon(item.fieldCode)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {item.labelOverride || item.fieldCode}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{item.fieldCode}</p>
            </div>
          </div>
        );

      case 'dot_walk':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-pink-50 text-pink-600">
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{item.displayLabel}</p>
              <p className="text-[10px] text-slate-400 truncate">{item.basePath}.{item.fieldCode}</p>
            </div>
          </div>
        );

      case 'embedded_list':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {item.tableCode} ({item.columns.length} columns)
              </p>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400">Spacer</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        );

      case 'divider':
        return (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-px bg-slate-300" />
            {item.label && <span className="text-xs text-slate-500">{item.label}</span>}
            <div className="flex-1 h-px bg-slate-300" />
          </div>
        );

      case 'info_box':
        return (
          <div className={`flex-1 p-2 rounded-lg ${getInfoBoxColor(item.variant)}`}>
            {item.title && <p className="text-xs font-medium mb-0.5">{item.title}</p>}
            <p className="text-xs truncate">{item.content}</p>
          </div>
        );

      case 'group':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{item.label || 'Field Group'}</p>
              <p className="text-[10px] text-slate-400 truncate">{item.fields.length} fields</p>
            </div>
          </div>
        );

      default:
        return <span className="text-sm text-slate-500">Unknown item</span>;
    }
  };

  // Get span from item (handles all types)
  const getItemSpan = (): number => {
    if ('span' in item && typeof item.span === 'number') {
      return item.span;
    }
    return 1;
  };

  if (mode === 'preview') {
    return (
      <div className={`${getSpanClass(getItemSpan())}`}>
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
          {renderItemContent()}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${getSpanClass(getItemSpan())}
        ${isDragging ? 'opacity-50 z-50' : ''}
      `}
    >
      <div
        onClick={onSelect}
        className={`
          group relative flex items-center gap-2 px-2.5 py-2 bg-white rounded-lg border cursor-pointer transition-all
          ${isSelected
            ? 'border-primary-400 ring-2 ring-primary-100 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }
        `}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Content */}
        {renderItemContent()}

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-danger-600 transition-opacity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// Section Component
const SectionComponent: React.FC<{
  section: DesignerSection;
  mode: 'edit' | 'preview';
  selectedItemId: string | null;
  onSelectItem: (id: string | null, type: DesignerState['selectedItemType']) => void;
  onRemoveItem: (id: string) => void;
  onRemoveSection: () => void;
  onUpdateSection: (updates: Partial<DesignerSection>) => void;
}> = ({
  section,
  mode,
  selectedItemId,
  onSelectItem,
  onRemoveItem,
  onRemoveSection,
  onUpdateSection,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(section.defaultCollapsed);
  const isSelected = selectedItemId === section.id;

  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
  });

  const getColumnsClass = () => {
    switch (section.columns) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 md:grid-cols-2';
      case 3: return 'grid-cols-1 md:grid-cols-3';
      case 4: return 'grid-cols-1 md:grid-cols-4';
      default: return 'grid-cols-1 md:grid-cols-2';
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelectItem(section.id, 'section');
      }}
      className={`
        rounded-xl border bg-white transition-all
        ${isSelected
          ? 'border-primary-400 ring-2 ring-primary-100 shadow-md'
          : 'border-slate-200 hover:shadow-sm'
        }
        ${isOver ? 'border-primary-300 bg-primary-50/50' : ''}
      `}
    >
      {/* Section Header */}
      {(section.label || mode === 'edit') && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white rounded-t-xl">
          <div className="flex items-center gap-2">
            {section.collapsible && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(!isCollapsed);
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
            <div className="w-1 h-4 rounded-full bg-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              {section.label || 'Untitled Section'}
            </h3>
            <span className="text-xs text-slate-400">
              {section.items.length} field{section.items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-1">
              {/* Column Toggle */}
              <div className="flex items-center bg-slate-100 rounded-md p-0.5 mr-2">
                {([1, 2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateSection({ columns: cols });
                    }}
                    className={`w-6 h-5 flex items-center justify-center rounded transition-colors ${
                      section.columns === cols
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {cols === 1 && <Square className="h-3 w-3" />}
                    {cols === 2 && <Columns2 className="h-3 w-3" />}
                    {cols === 3 && <Columns3 className="h-3 w-3" />}
                    {cols === 4 && <span className="text-[10px] font-medium">4</span>}
                  </button>
                ))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(section.id, 'section');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSection();
                }}
                className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Section Content */}
      {!isCollapsed && (
        <div className="p-4">
          {section.items.length === 0 ? (
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isOver ? 'border-primary-300 bg-primary-50' : 'border-slate-200'
            }`}>
              <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {mode === 'edit' ? 'Drag fields here' : 'No fields in this section'}
              </p>
            </div>
          ) : (
            <SortableContext
              items={section.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={`grid gap-3 ${getColumnsClass()}`}>
                {section.items.map((item) => (
                  <SortableFieldItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={() => onSelectItem(item.id, 'field')}
                    onRemove={() => onRemoveItem(item.id)}
                    mode={mode}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
};

export const LayoutCanvas: React.FC<LayoutCanvasProps> = ({
  tab,
  mode,
  selectedItemId,
  onSelectItem,
  onAddSection,
  onRemoveItem,
  onRemoveSection,
  onUpdateSection,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Tab Header (Preview mode) */}
      {mode === 'preview' && tab.label && (
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900">{tab.label}</h2>
          {tab.sections.length > 0 && (
            <p className="text-sm text-slate-500 mt-1">
              {tab.sections.reduce((acc, s) => acc + s.items.length, 0)} fields
            </p>
          )}
        </div>
      )}

      {/* Sections */}
      {tab.sections.map((section) => (
        <SectionComponent
          key={section.id}
          section={section}
          mode={mode}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onRemoveItem={onRemoveItem}
          onRemoveSection={() => onRemoveSection(section.id)}
          onUpdateSection={(updates) => onUpdateSection(section.id, updates)}
        />
      ))}

      {/* Add Section Button */}
      {mode === 'edit' && (
        <button
          onClick={onAddSection}
          className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50/50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add Section</span>
        </button>
      )}
    </div>
  );
};

// Helper functions
function getFieldTypeColor(_fieldCode: string): string {
  // This would typically look up the actual field type
  return 'bg-slate-100 text-slate-600';
}

function getFieldTypeIcon(_fieldCode: string): React.ReactNode {
  // This would typically look up the actual field type
  return <Type className="h-3.5 w-3.5" />;
}

function getInfoBoxColor(variant: string): string {
  switch (variant) {
    case 'info': return 'bg-blue-50 text-blue-700';
    case 'warning': return 'bg-amber-50 text-amber-700';
    case 'success': return 'bg-green-50 text-green-700';
    case 'error': return 'bg-red-50 text-red-700';
    default: return 'bg-slate-50 text-slate-700';
  }
}

export default LayoutCanvas;
