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

// Sortable Property Item Component
const SortablePropertyItem: React.FC<{
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
      case 'property':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
              {getPropertyTypeIcon(item.propertyCode)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {item.labelOverride || item.propertyCode}
              </p>
              <p className="text-[10px] truncate text-muted-foreground/70">
                {item.propertyCode}
              </p>
            </div>
          </div>
        );

      case 'dot_walk':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {item.displayLabel}
              </p>
              <p className="text-[10px] truncate text-muted-foreground/70">
                {item.basePath}.{item.propertyCode}
              </p>
            </div>
          </div>
        );

      case 'embedded_list':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {item.label}
              </p>
              <p className="text-[10px] truncate text-muted-foreground/70">
                {item.collectionCode} ({item.columns.length} columns)
              </p>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground/70">
              Spacer
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        );

      case 'divider':
        return (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-px bg-border" />
            {item.label && (
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>
            )}
            <div className="flex-1 h-px bg-border" />
          </div>
        );

      case 'info_box':
        return (
          <div className={`flex-1 p-2 rounded-lg ${getInfoBoxClasses(item.variant)}`}>
            {item.title && <p className="text-xs font-medium mb-0.5">{item.title}</p>}
            <p className="text-xs truncate">{item.content}</p>
          </div>
        );

      case 'group':
        return (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {item.label || 'Field Group'}
              </p>
              <p className="text-[10px] truncate text-muted-foreground/70">
                {item.properties.length} properties
              </p>
            </div>
          </div>
        );

      default:
        return (
          <span className="text-sm text-muted-foreground">
            Unknown item
          </span>
        );
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
        <div className="p-3 rounded-lg bg-card border border-border">
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
      aria-grabbed={isDragging}
    >
      <div
        onClick={onSelect}
        className={`
          group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all
          bg-card border
          ${isSelected
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border hover:border-border/80 hover:shadow-sm'}
        `}
        role="listitem"
        aria-selected={isSelected}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-border hover:text-muted-foreground/70"
          aria-label="Drag to reorder"
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
          className="opacity-0 group-hover:opacity-100 p-1 transition-opacity text-muted-foreground/70 hover:text-destructive"
          aria-label={`Remove ${item.type === 'property' ? item.propertyCode : item.type}`}
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
        rounded-xl transition-all border
        ${isOver ? 'bg-primary/5 border-primary' : 'bg-card border-border'}
        ${isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-sm'
          : 'hover:shadow-sm'}
      `}
      role="region"
      aria-label={section.label || 'Untitled Section'}
    >
      {/* Section Header */}
      {(section.label || mode === 'edit') && (
        <div className="flex items-center justify-between px-4 py-3 rounded-t-xl border-b border-border bg-gradient-to-r from-muted to-card">
          <div className="flex items-center gap-2">
            {section.collapsible && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(!isCollapsed);
                }}
                className="p-0.5 text-muted-foreground/70 hover:text-muted-foreground"
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
            <div className="w-1 h-4 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {section.label || 'Untitled Section'}
            </h3>
            <span className="text-xs text-muted-foreground/70">
              {section.items.length} field{section.items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-1">
              {/* Column Toggle */}
              <div className="flex items-center rounded-md p-0.5 mr-2 bg-muted">
                {([1, 2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateSection({ columns: cols });
                    }}
                    className={`
                      w-6 h-5 flex items-center justify-center rounded transition-colors
                      ${section.columns === cols
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground/70 hover:text-muted-foreground'}
                    `}
                    aria-label={`Set ${cols} column${cols > 1 ? 's' : ''}`}
                    aria-pressed={section.columns === cols}
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
                className="p-1.5 rounded transition-colors text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted"
                aria-label="Section settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSection();
                }}
                className="p-1.5 rounded transition-colors text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10"
                aria-label="Remove section"
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
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border'}
              `}
              role="list"
              aria-label="Empty field list"
            >
              <Layers className="h-8 w-8 mx-auto mb-2 text-border" />
              <p className="text-sm text-muted-foreground">
                {mode === 'edit' ? 'Drag fields here' : 'No fields in this section'}
              </p>
            </div>
          ) : (
            <SortableContext
              items={section.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={`grid gap-3 ${getColumnsClass()}`}
                role="list"
                aria-label={`${section.label || 'Section'} fields`}
              >
                {section.items.map((item) => (
                  <SortablePropertyItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={() => onSelectItem(item.id, 'property')}
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
    <div className="max-w-5xl 2xl:max-w-6xl mx-auto space-y-5">
      {/* Tab Header (Preview mode) */}
      {mode === 'preview' && tab.label && (
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            {tab.label}
          </h2>
          {tab.sections.length > 0 && (
            <p className="text-sm mt-1 text-muted-foreground">
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
          className="w-full p-4 border-2 border-dashed rounded-xl transition-all flex items-center justify-center gap-2 border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
          aria-label="Add new section"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Add Section</span>
        </button>
      )}
    </div>
  );
};

// Helper functions
function getPropertyTypeIcon(_propertyCode: string): React.ReactNode {
  return <Type className="h-3.5 w-3.5" />;
}

function getInfoBoxClasses(variant: string): string {
  switch (variant) {
    case 'info':
      return 'bg-info-subtle text-info-text';
    case 'warning':
      return 'bg-warning-subtle text-warning-text';
    case 'success':
      return 'bg-success-subtle text-success-text';
    case 'error':
      return 'bg-danger-subtle text-danger-text';
    default:
      return 'bg-muted text-foreground';
  }
}

export default LayoutCanvas;
