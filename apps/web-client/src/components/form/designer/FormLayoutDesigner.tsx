import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  X,
  Undo2,
  Redo2,
  Eye,
  Pencil,
  Save,
  RotateCcw,
  Layers,
  Plus,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Columns3,
  Square,
  Link2,
  Table2,
} from 'lucide-react';
import { ModelField } from '../../../services/platform.service';
import { useDesignerState } from './hooks/useDesignerState';
import { FieldPalette } from './FieldPalette';
import { LayoutCanvas } from './LayoutCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { DotWalkSelector } from './DotWalkSelector';
import { EmbeddedListConfig } from './EmbeddedListConfig';
import {
  DesignerLayout,
  DesignerItem,
  DesignerDotWalkField,
  DesignerEmbeddedList,
  FieldProtection,
  PaletteItem,
  createDefaultField,
  createDefaultSection,
  createDefaultTab,
  generateId,
} from './types';

interface RelatedTable {
  tableCode: string;
  tableName: string;
  referenceField: string;
  description?: string;
}

interface FormLayoutDesignerProps {
  tableCode: string;
  fields: ModelField[];
  initialLayout?: DesignerLayout;
  fieldProtections?: FieldProtection[];
  relatedTables?: RelatedTable[];
  onFetchTableFields?: (tableCode: string) => Promise<ModelField[]>;
  onSave: (layout: DesignerLayout) => Promise<void>;
  onClose: () => void;
}

export const FormLayoutDesigner: React.FC<FormLayoutDesignerProps> = ({
  tableCode,
  fields,
  initialLayout,
  fieldProtections = [],
  relatedTables = [],
  onFetchTableFields,
  onSave,
  onClose,
}) => {
  const {
    layout,
    selectedItemId,
    selectedItemType,
    isDirty,
    mode,
    canUndo,
    canRedo,
    selectedItem,
    selectedSection,
    selectedTab,
    fieldsInLayout,
    selectItem,
    updateItem,
    addItem,
    removeItem,
    moveItem,
    addSection,
    updateSection,
    removeSection,
    addTab,
    updateTab,
    removeTab,
    setMode,
    undo,
    redo,
    reset,
  } = useDesignerState(initialLayout);

  const [activeTabId, setActiveTabId] = useState<string>(layout.tabs[0]?.id || '');
  const [showPalette, setShowPalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<PaletteItem | DesignerItem | null>(null);
  const [showDotWalkSelector, setShowDotWalkSelector] = useState(false);
  const [showEmbeddedListConfig, setShowEmbeddedListConfig] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Save: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !saving) handleSave();
        return;
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault();
        if (selectedItemType === 'field' || selectedItemType === 'embedded_list') {
          removeItem(selectedItemId);
        } else if (selectedItemType === 'section' && selectedSection) {
          removeSection(selectedItemId);
        } else if (selectedItemType === 'tab' && layout.tabs.length > 1) {
          removeTab(selectedItemId);
        }
        return;
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        selectItem(null, null);
        setShowDotWalkSelector(false);
        setShowEmbeddedListConfig(false);
        return;
      }

      // Toggle preview: Ctrl+P / Cmd+P
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setMode(mode === 'edit' ? 'preview' : 'edit');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    isDirty,
    saving,
    selectedItemId,
    selectedItemType,
    selectedSection,
    layout.tabs.length,
    removeItem,
    removeSection,
    removeTab,
    selectItem,
    mode,
    setMode,
  ]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build protection map
  const protectionMap = useMemo(() => {
    const map = new Map<string, FieldProtection>();
    fieldProtections.forEach((p) => map.set(p.fieldCode, p));
    return map;
  }, [fieldProtections]);

  // Build palette items from fields
  const paletteItems = useMemo<PaletteItem[]>(() => {
    return fields.map((field) => {
      const protection = protectionMap.get(field.code);
      return {
        id: `palette-${field.code}`,
        type: 'field' as const,
        label: field.label,
        icon: getFieldTypeIcon(field.type),
        description: field.code,
        category: 'fields' as const,
        protection: protection?.protectionLevel || 'flexible',
        fieldCode: field.code,
        fieldType: field.type,
        isInLayout: fieldsInLayout.has(field.code),
      };
    });
  }, [fields, protectionMap, fieldsInLayout]);

  // Get current tab
  const currentTab = useMemo(
    () => layout.tabs.find((t) => t.id === activeTabId) || layout.tabs[0],
    [layout.tabs, activeTabId]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;

    // Check if dragging from palette or from canvas
    if (id.startsWith('palette-')) {
      const paletteItem = paletteItems.find((p) => p.id === id);
      if (paletteItem) {
        setDraggedItem(paletteItem);
      }
    } else {
      // Find item in layout
      for (const tab of layout.tabs) {
        for (const section of tab.sections) {
          const item = section.items.find((i) => i.id === id);
          if (item) {
            setDraggedItem(item);
            break;
          }
        }
      }
    }
  }, [paletteItems, layout]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle palette item drop
    if (activeId.startsWith('palette-')) {
      const paletteItem = paletteItems.find((p) => p.id === activeId);
      if (!paletteItem || paletteItem.protection === 'locked') return;

      // Create new field item
      if (paletteItem.type === 'field' && paletteItem.fieldCode) {
        const newItem = createDefaultField(paletteItem.fieldCode, paletteItem.label);

        // Determine target location from overId
        const location = parseDropTarget(overId, layout, currentTab.id);
        if (location) {
          addItem(newItem, location);
        }
      }
    } else if (activeId !== overId) {
      // Handle reordering within layout
      const targetLocation = parseDropTarget(overId, layout, currentTab.id);
      if (targetLocation) {
        moveItem(activeId, targetLocation);
      }
    }
  }, [paletteItems, layout, currentTab.id, addItem, moveItem]);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could be used for visual feedback during drag
  }, []);

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(layout);
    } finally {
      setSaving(false);
    }
  };

  // Handle add new section
  const handleAddSection = () => {
    const newSection = createDefaultSection('New Section');
    addSection(newSection, currentTab.id);
    selectItem(newSection.id, 'section');
  };

  // Handle add new tab
  const handleAddTab = () => {
    const newTab = createDefaultTab('New Tab');
    addTab(newTab);
    setActiveTabId(newTab.id);
    selectItem(newTab.id, 'tab');
  };

  // Handle column change for selected section
  const handleColumnsChange = (columns: 1 | 2 | 3 | 4) => {
    if (selectedSection) {
      updateSection(selectedSection.id, { columns });
    }
  };

  // Handle add dot-walk field
  const handleAddDotWalkField = (fieldPath: string[], displayLabel: string, _finalField: ModelField) => {
    if (!currentTab || currentTab.sections.length === 0) return;

    const newItem: DesignerDotWalkField = {
      type: 'dot_walk',
      id: generateId(),
      basePath: fieldPath.slice(0, -1).join('.'),
      fieldCode: fieldPath[fieldPath.length - 1],
      displayLabel,
      referenceChain: fieldPath.slice(0, -1),
      span: 1,
    };

    // Add to the first section of the current tab
    const targetSection = currentTab.sections[0];
    addItem(newItem, {
      tabId: currentTab.id,
      sectionId: targetSection.id,
      index: targetSection.items.length,
    });

    setShowDotWalkSelector(false);
    selectItem(newItem.id, 'field');
  };

  // Handle add embedded list
  const handleAddEmbeddedList = (config: DesignerEmbeddedList) => {
    if (!currentTab || currentTab.sections.length === 0) return;

    // Add to the first section of the current tab
    const targetSection = currentTab.sections[0];
    addItem(config, {
      tabId: currentTab.id,
      sectionId: targetSection.id,
      index: targetSection.items.length,
    });

    setShowEmbeddedListConfig(false);
    selectItem(config.id, 'embedded_list');
  };

  // Default fetch table fields handler (placeholder)
  const fetchTableFieldsHandler = onFetchTableFields || (async (_tableCode: string): Promise<ModelField[]> => {
    // In a real implementation, this would fetch from the API
    console.warn('No onFetchTableFields handler provided');
    return [];
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-stretch">
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="h-14 px-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Form Layout Designer</h2>
              <p className="text-xs text-slate-500">{tableCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setMode('edit')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'edit'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pencil className="h-3.5 w-3.5 inline-block mr-1" />
                Edit
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'preview'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="h-3.5 w-3.5 inline-block mr-1" />
                Preview
              </button>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center border-l border-slate-200 pl-2 ml-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={reset}
              disabled={!isDirty}
              className="p-2 text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
              title="Reset to original"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Save & Close */}
            <div className="flex items-center border-l border-slate-200 pl-2 ml-2 gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Layout
                  </>
                )}
              </button>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="h-12 px-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {layout.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                  tab.id === activeTabId
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
                {mode === 'edit' && (
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {tab.sections.reduce((acc, s) => acc + s.items.length, 0)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {mode === 'edit' && (
            <button
              onClick={handleAddTab}
              className="h-8 px-3 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Tab
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            {/* Left Panel - Field Palette */}
            {mode === 'edit' && (
              <div
                className={`border-r border-slate-200 bg-white transition-all duration-200 ${
                  showPalette ? 'w-64' : 'w-10'
                }`}
              >
                <div className="h-full flex flex-col">
                  {/* Toggle Button */}
                  <button
                    onClick={() => setShowPalette(!showPalette)}
                    className="h-10 px-3 border-b border-slate-100 flex items-center gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {showPalette ? (
                      <>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-xs font-medium">Fields</span>
                      </>
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {showPalette && (
                    <FieldPalette
                      items={paletteItems}
                      fieldsInLayout={fieldsInLayout}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Center - Layout Canvas */}
            <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <LayoutCanvas
                tab={currentTab}
                mode={mode}
                selectedItemId={selectedItemId}
                onSelectItem={selectItem}
                onAddSection={handleAddSection}
                onRemoveItem={removeItem}
                onRemoveSection={removeSection}
                onUpdateSection={updateSection}
              />
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {draggedItem && (
                <div className="px-3 py-2 bg-white border border-primary-300 rounded-lg shadow-lg opacity-80">
                  <span className="text-sm font-medium text-slate-900">
                    {'label' in draggedItem ? draggedItem.label : 'fieldCode' in draggedItem ? draggedItem.fieldCode : 'Item'}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {/* Right Panel - Properties */}
          {mode === 'edit' && (
            <div
              className={`border-l border-slate-200 bg-white transition-all duration-200 ${
                showProperties ? 'w-72' : 'w-10'
              }`}
            >
              <div className="h-full flex flex-col">
                {/* Toggle Button */}
                <button
                  onClick={() => setShowProperties(!showProperties)}
                  className="h-10 px-3 border-b border-slate-100 flex items-center justify-end gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {showProperties ? (
                    <>
                      <span className="text-xs font-medium">Properties</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>

                {showProperties && (
                  <PropertiesPanel
                    selectedItem={selectedItem}
                    selectedSection={selectedSection}
                    selectedTab={selectedTab}
                    selectedItemType={selectedItemType}
                    fields={fields}
                    onUpdateItem={updateItem}
                    onUpdateSection={updateSection}
                    onUpdateTab={updateTab}
                    onRemoveItem={removeItem}
                    onRemoveSection={removeSection}
                    onRemoveTab={removeTab}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Toolbar */}
        {mode === 'edit' && selectedSection && (
          <div className="h-12 px-4 border-t border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Section columns:</span>
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                {([1, 2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    onClick={() => handleColumnsChange(cols)}
                    className={`w-8 h-7 flex items-center justify-center rounded-md transition-colors ${
                      selectedSection.columns === cols
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title={`${cols} column${cols > 1 ? 's' : ''}`}
                  >
                    {cols === 1 && <Square className="h-3.5 w-3.5" />}
                    {cols === 2 && <Columns2 className="h-3.5 w-3.5" />}
                    {cols === 3 && <Columns3 className="h-3.5 w-3.5" />}
                    {cols === 4 && <Settings2 className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Dot-Walk Field Button */}
              <button
                onClick={() => setShowDotWalkSelector(true)}
                className="h-8 px-3 text-xs font-medium text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition-colors flex items-center gap-1"
                title="Add field from related table"
              >
                <Link2 className="h-3.5 w-3.5" />
                Dot-Walk
              </button>

              {/* Embedded List Button */}
              {relatedTables.length > 0 && (
                <button
                  onClick={() => setShowEmbeddedListConfig(true)}
                  className="h-8 px-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                  title="Add embedded related list"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Related List
                </button>
              )}

              {/* Add Section Button */}
              <button
                onClick={handleAddSection}
                className="h-8 px-3 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Section
              </button>
            </div>
          </div>
        )}

        {/* Dot-Walk Selector Modal */}
        {showDotWalkSelector && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
            <DotWalkSelector
              baseTableCode={tableCode}
              baseFields={fields}
              onFetchTableFields={fetchTableFieldsHandler}
              onSelectField={handleAddDotWalkField}
              onClose={() => setShowDotWalkSelector(false)}
            />
          </div>
        )}

        {/* Embedded List Config Modal */}
        {showEmbeddedListConfig && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50">
            <EmbeddedListConfig
              parentTableCode={tableCode}
              relatedTables={relatedTables}
              onFetchTableFields={fetchTableFieldsHandler}
              onSave={handleAddEmbeddedList}
              onClose={() => setShowEmbeddedListConfig(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get icon name for field type
function getFieldTypeIcon(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'type',
    text: 'file-text',
    rich_text: 'file-text',
    integer: 'hash',
    long: 'hash',
    decimal: 'hash',
    number: 'hash',
    currency: 'dollar-sign',
    percent: 'percent',
    date: 'calendar',
    datetime: 'clock',
    time: 'clock',
    boolean: 'toggle-left',
    choice: 'list',
    multi_choice: 'list',
    tags: 'tags',
    reference: 'link-2',
    multi_reference: 'link-2',
    user_reference: 'user',
    email: 'mail',
    phone: 'phone',
    url: 'globe',
    file: 'paperclip',
    image: 'image',
    json: 'code',
  };
  return typeMap[type?.toLowerCase()] || 'square';
}

// Helper function to parse drop target ID into location
function parseDropTarget(
  targetId: string,
  layout: DesignerLayout,
  currentTabId: string
): { tabId: string; sectionId: string; index: number } | null {
  // Format: section-{sectionId} or item-{itemId} or drop-zone-{sectionId}-{index}
  if (targetId.startsWith('drop-zone-')) {
    const parts = targetId.replace('drop-zone-', '').split('-');
    const sectionId = parts.slice(0, -1).join('-');
    const index = parseInt(parts[parts.length - 1], 10);
    return { tabId: currentTabId, sectionId, index };
  }

  if (targetId.startsWith('section-')) {
    const sectionId = targetId.replace('section-', '');
    const tab = layout.tabs.find((t) => t.sections.some((s) => s.id === sectionId));
    if (tab) {
      const section = tab.sections.find((s) => s.id === sectionId);
      if (section) {
        return { tabId: tab.id, sectionId, index: section.items.length };
      }
    }
  }

  // Find item and get its location
  for (const tab of layout.tabs) {
    for (const section of tab.sections) {
      const itemIndex = section.items.findIndex((i) => i.id === targetId);
      if (itemIndex !== -1) {
        return { tabId: tab.id, sectionId: section.id, index: itemIndex + 1 };
      }
    }
  }

  return null;
}

export default FormLayoutDesigner;
