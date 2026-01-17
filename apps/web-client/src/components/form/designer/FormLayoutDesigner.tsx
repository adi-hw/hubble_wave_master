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
import { ModelProperty } from '../../../services/platform.service';
import { useDesignerState } from './hooks/useDesignerState';
import { PropertyPalette } from './FieldPalette';
import { LayoutCanvas } from './LayoutCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { DotWalkSelector } from './DotWalkSelector';
import { EmbeddedListConfig } from './EmbeddedListConfig';
import {
  DesignerLayout,
  DesignerItem,
  DesignerDotWalkProperty,
  DesignerEmbeddedList,
  PropertyProtection,
  PaletteItem,
  createDefaultProperty,
  createDefaultSection,
  createDefaultTab,
  generateId,
} from './types';

interface RelatedCollection {
  collectionCode: string;
  collectionName: string;
  referenceProperty: string;
  description?: string;
}

interface FormLayoutDesignerProps {
  collectionCode: string;
  fields: ModelProperty[];
  initialLayout?: DesignerLayout;
  propertyProtections?: PropertyProtection[];
  relatedCollections?: RelatedCollection[];
  onFetchCollectionProperties?: (collectionCode: string) => Promise<ModelProperty[]>;
  onSave: (layout: DesignerLayout) => Promise<void>;
  onClose: () => void;
  variant?: 'modal' | 'embedded';
}

export const FormLayoutDesigner: React.FC<FormLayoutDesignerProps> = ({
  collectionCode,
  fields,
  initialLayout,
  propertyProtections = [],
  relatedCollections = [],
  onFetchCollectionProperties,
  onSave,
  onClose,
  variant = 'modal',
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
    propertiesInLayout,
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
  const [showProperties, setShowProperties] = useState(variant === 'modal');
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<PaletteItem | DesignerItem | null>(null);
  const [showDotWalkSelector, setShowDotWalkSelector] = useState(false);
  const [showEmbeddedListConfig, setShowEmbeddedListConfig] = useState(false);
  const isEmbedded = variant === 'embedded';
  const panelCollapsedWidth = isEmbedded ? 'w-9' : 'w-10';
  const paletteWidth = isEmbedded ? 'w-56' : 'w-64';
  const propertiesWidth = isEmbedded ? 'w-64' : 'w-72';
  const headerHeight = isEmbedded ? 'h-12 px-3' : 'h-14 px-4';
  const tabBarHeight = isEmbedded ? 'h-10 px-3' : 'h-12 px-4';
  const tabButtonClasses = isEmbedded
    ? 'px-3 py-1.5 text-xs min-h-[36px]'
    : 'px-4 py-2 text-sm min-h-[44px]';
  const addTabLabel = isEmbedded ? 'New Tab' : 'Add Tab';

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
        if (selectedItemType === 'property' || selectedItemType === 'embedded_list') {
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
    const map = new Map<string, PropertyProtection>();
    propertyProtections.forEach((p) => map.set(p.propertyCode, p));
    return map;
  }, [propertyProtections]);

  // Build palette items from fields
  const paletteItems = useMemo<PaletteItem[]>(() => {
    return fields.map((field) => {
      const protection = protectionMap.get(field.code);
      return {
        id: `palette-${field.code}`,
        type: 'property' as const,
        label: field.label,
        icon: getFieldTypeIcon(field.type),
        description: field.code,
        category: 'properties' as const,
        protection: protection?.protectionLevel || 'flexible',
        propertyCode: field.code,
        propertyType: field.type,
        isInLayout: propertiesInLayout.has(field.code),
      };
    });
  }, [fields, protectionMap, propertiesInLayout]);

  // Get current tab
  const currentTab = useMemo(
    () => layout.tabs.find((t) => t.id === activeTabId) || layout.tabs[0],
    [layout.tabs, activeTabId]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const paletteItem = event.active.data.current?.item as PaletteItem | undefined;
    if (paletteItem) {
      setDraggedItem(paletteItem);
      return;
    }

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

    const overId = over.id as string;
    const paletteItem = active.data.current?.item as PaletteItem | undefined;
    const targetLocation = parseDropTarget(overId, layout, currentTab.id) || getFallbackLocation(layout, currentTab.id);

    if (paletteItem) {
      if (paletteItem.protection === 'locked') return;

      if (paletteItem.type === 'property' && paletteItem.propertyCode) {
        const newItem = createDefaultProperty(paletteItem.propertyCode, paletteItem.label);
        if (targetLocation) {
          addItem(newItem, targetLocation);
          selectItem(newItem.id, 'property');
        }
        return;
      }

      if (paletteItem.type === 'new_section') {
        const tabId = targetLocation?.tabId || currentTab.id;
        const insertIndex = resolveSectionInsertIndex(layout, tabId, targetLocation?.sectionId);
        const newSection = createDefaultSection('New Section');
        addSection(newSection, tabId, insertIndex);
        selectItem(newSection.id, 'section');
        return;
      }

      if (paletteItem.type === 'new_tab') {
        const newTab = createDefaultTab('New Tab');
        addTab(newTab);
        setActiveTabId(newTab.id);
        selectItem(newTab.id, 'tab');
        return;
      }

      const layoutItem = createLayoutItemFromPalette(paletteItem);
      if (layoutItem && targetLocation) {
        addItem(layoutItem, targetLocation);
        selectItem(layoutItem.id, 'property');
      }
      return;
    }

    const activeId = active.id as string;

    if (activeId !== overId) {
      // Handle reordering within layout
      const targetLocation = parseDropTarget(overId, layout, currentTab.id);
      if (targetLocation) {
        moveItem(activeId, targetLocation);
      }
    }
  }, [layout, currentTab.id, addItem, addSection, addTab, moveItem, selectItem, setActiveTabId]);

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

  // Handle add dot-walk property
  const handleAddDotWalkProperty = (propertyPath: string[], displayLabel: string, _finalProperty: ModelProperty) => {
    if (!currentTab || currentTab.sections.length === 0) return;

    const newItem: DesignerDotWalkProperty = {
      type: 'dot_walk',
      id: generateId(),
      basePath: propertyPath.slice(0, -1).join('.'),
      propertyCode: propertyPath[propertyPath.length - 1],
      displayLabel,
      referenceChain: propertyPath.slice(0, -1),
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
    selectItem(newItem.id, 'property');
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

  // Default fetch collection properties handler (placeholder)
  const fetchCollectionPropertiesHandler = onFetchCollectionProperties || (async (_collectionCode: string): Promise<ModelProperty[]> => {
    // In a real implementation, this would fetch from the API
    console.warn('No onFetchCollectionProperties handler provided');
    return [];
  });

  return (
    <div
      className={
        isEmbedded
          ? 'relative w-full flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-[70vh]'
          : 'fixed inset-0 z-[60] flex items-stretch bg-overlay/50'
      }
      role={isEmbedded ? 'region' : 'dialog'}
      aria-modal={isEmbedded ? undefined : true}
      aria-label="Form Layout Designer"
    >
      <div className={`flex-1 flex flex-col ${isEmbedded ? '' : 'bg-card'}`}>
        {/* Header */}
        <div
          className={`${headerHeight} flex items-center justify-between flex-shrink-0 border-b border-border bg-card`}
        >
          {isEmbedded ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Form Builder
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {collectionCode}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10"
              >
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Form Layout Designer
                </h2>
                <p className="text-xs text-muted-foreground">
                  {collectionCode}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center rounded-lg p-0.5 bg-muted">
              <button
                onClick={() => setMode('edit')}
                className={`${
                  isEmbedded ? 'px-2.5 py-1' : 'px-3 py-1.5'
                } text-xs font-medium rounded-md transition-colors ${
                  mode === 'edit'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={mode === 'edit'}
                aria-label="Edit mode"
              >
                <Pencil className="h-3.5 w-3.5 inline-block mr-1" />
                Edit
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`${
                  isEmbedded ? 'px-2.5 py-1' : 'px-3 py-1.5'
                } text-xs font-medium rounded-md transition-colors ${
                  mode === 'preview'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={mode === 'preview'}
                aria-label="Preview mode"
              >
                <Eye className="h-3.5 w-3.5 inline-block mr-1" />
                Preview
              </button>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center pl-2 ml-2 border-l border-border">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                  !canUndo
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground cursor-pointer'
                }`}
                title="Undo (Ctrl+Z)"
                aria-label="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                  !canRedo
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground cursor-pointer'
                }`}
                title="Redo (Ctrl+Y)"
                aria-label="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={reset}
              disabled={!isDirty}
              className={`p-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                !isDirty
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground cursor-pointer'
              }`}
              title="Reset to original"
              aria-label="Reset to original"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <div className="flex items-center pl-2 ml-2 gap-2 border-l border-border">
              {!isEmbedded && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm font-medium transition-colors min-h-[44px] text-muted-foreground hover:text-foreground"
                  aria-label="Cancel"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`${
                  isEmbedded ? 'px-3 py-1.5 text-xs' : 'px-4 py-1.5 text-sm'
                } font-medium rounded-lg transition-colors flex items-center gap-2 min-h-[44px] text-primary-foreground ${
                  saving || !isDirty
                    ? 'bg-primary opacity-50 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 cursor-pointer'
                }`}
                aria-label="Save layout"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {isEmbedded ? 'Save' : 'Save Layout'}
                  </>
                )}
              </button>
            </div>

            {!isEmbedded && (
              <button
                onClick={onClose}
                className="p-2 transition-colors ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground"
                aria-label="Close designer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div
          className={`${tabBarHeight} flex items-center gap-2 flex-shrink-0 border-b border-border ${isEmbedded ? 'bg-card' : 'bg-muted'}`}
        >
          <div className="flex-1 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Form tabs">
            {layout.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`${tabButtonClasses} font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                  tab.id === activeTabId
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                }`}
                role="tab"
                aria-selected={tab.id === activeTabId}
                aria-controls={`tabpanel-${tab.id}`}
              >
                {tab.label}
                {mode === 'edit' && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground/50 bg-muted"
                  >
                    {tab.sections.reduce((acc, s) => acc + s.items.length, 0)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {mode === 'edit' && (
            <button
              onClick={handleAddTab}
              className="h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[44px] text-primary hover:bg-primary/10"
              aria-label="Add new tab"
            >
              <Plus className="h-3.5 w-3.5" />
              {addTabLabel}
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
                className={`transition-all duration-200 ${showPalette ? paletteWidth : panelCollapsedWidth} border-r border-border bg-card`}
              >
                <div className="h-full flex flex-col">
                  {/* Toggle Button */}
                  <button
                    onClick={() => setShowPalette(!showPalette)}
                    className="h-10 px-3 flex items-center gap-2 transition-colors min-h-[44px] border-b border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    aria-label={showPalette ? 'Hide field palette' : 'Show field palette'}
                    aria-expanded={showPalette}
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
                    <PropertyPalette
                      items={paletteItems}
                      propertiesInLayout={propertiesInLayout}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Center - Layout Canvas */}
            <div
              className="flex-1 overflow-auto p-5 bg-muted/40"
              role="tabpanel"
              id={`tabpanel-${activeTabId}`}
              aria-labelledby={`tab-${activeTabId}`}
            >
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
                <div
                  className="px-3 py-2 rounded-lg shadow-lg opacity-80 bg-card border border-primary"
                >
                  <span className="text-sm font-medium text-foreground">
                    {'label' in draggedItem ? draggedItem.label : 'propertyCode' in draggedItem ? draggedItem.propertyCode : 'Item'}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {/* Right Panel - Properties */}
          {mode === 'edit' && (
            <div
              className={`transition-all duration-200 ${showProperties ? propertiesWidth : panelCollapsedWidth} border-l border-border bg-card`}
            >
              <div className="h-full flex flex-col">
                {/* Toggle Button */}
                <button
                  onClick={() => setShowProperties(!showProperties)}
                  className="h-10 px-3 flex items-center justify-end gap-2 transition-colors min-h-[44px] border-b border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  aria-label={showProperties ? 'Hide properties panel' : 'Show properties panel'}
                  aria-expanded={showProperties}
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
        {mode === 'edit' && selectedSection && !isEmbedded && (
          <div
            className="h-12 px-4 flex items-center justify-between flex-shrink-0 border-t border-border bg-card"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Section columns:
              </span>
              <div className="flex items-center rounded-lg p-0.5 bg-muted">
                {([1, 2, 3, 4] as const).map((cols) => (
                  <button
                    key={cols}
                    onClick={() => handleColumnsChange(cols)}
                    className={`w-8 h-7 flex items-center justify-center rounded-md transition-colors min-w-[44px] min-h-[44px] ${
                      selectedSection.columns === cols
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={`${cols} column${cols > 1 ? 's' : ''}`}
                    aria-label={`${cols} column${cols > 1 ? 's' : ''}`}
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
                className="h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[44px] text-primary hover:bg-primary/10"
                title="Add property from related collection"
                aria-label="Add dot-walk property from related collection"
              >
                <Link2 className="h-3.5 w-3.5" />
                Dot-Walk
              </button>

              {/* Embedded List Button */}
              {relatedCollections.length > 0 && (
                <button
                  onClick={() => setShowEmbeddedListConfig(true)}
                  className="h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[44px] text-primary hover:bg-primary/10"
                  title="Add embedded related list"
                  aria-label="Add embedded related list"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Related List
                </button>
              )}

              {/* Add Section Button */}
              <button
                onClick={handleAddSection}
                className="h-8 px-3 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[44px] text-primary hover:bg-primary/10"
                aria-label="Add new section"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Section
              </button>
            </div>
          </div>
        )}

        {/* Dot-Walk Selector Modal */}
        {showDotWalkSelector && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/50"
            role="dialog"
            aria-modal="true"
            aria-label="Dot-walk property selector"
          >
            <DotWalkSelector
              baseCollectionCode={collectionCode}
              baseProperties={fields}
              onFetchCollectionProperties={fetchCollectionPropertiesHandler}
              onSelectProperty={handleAddDotWalkProperty}
              onClose={() => setShowDotWalkSelector(false)}
            />
          </div>
        )}

        {/* Embedded List Config Modal */}
        {showEmbeddedListConfig && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/50"
            role="dialog"
            aria-modal="true"
            aria-label="Embedded list configuration"
          >
            <EmbeddedListConfig
              parentCollectionCode={collectionCode}
              relatedCollections={relatedCollections}
              onFetchCollectionProperties={fetchCollectionPropertiesHandler}
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

function getFallbackLocation(
  layout: DesignerLayout,
  currentTabId: string
): { tabId: string; sectionId: string; index: number } | null {
  const tab = layout.tabs.find((t) => t.id === currentTabId) || layout.tabs[0];
  if (!tab || tab.sections.length === 0) return null;
  const section = tab.sections[tab.sections.length - 1];
  return {
    tabId: tab.id,
    sectionId: section.id,
    index: section.items.length,
  };
}

function resolveSectionInsertIndex(
  layout: DesignerLayout,
  tabId: string,
  sectionId?: string
): number {
  const tab = layout.tabs.find((t) => t.id === tabId);
  if (!tab) return 0;
  if (!sectionId) return tab.sections.length;
  const sectionIndex = tab.sections.findIndex((section) => section.id === sectionId);
  return sectionIndex === -1 ? tab.sections.length : sectionIndex + 1;
}

function createLayoutItemFromPalette(paletteItem: PaletteItem): DesignerItem | null {
  switch (paletteItem.type) {
    case 'spacer':
      return {
        type: 'spacer',
        id: generateId(),
        height: 'medium',
        span: 1,
      };
    case 'divider':
      return {
        type: 'divider',
        id: generateId(),
        span: 1,
      };
    case 'info_box':
      return {
        type: 'info_box',
        id: generateId(),
        title: 'Info',
        content: 'Add details here.',
        variant: 'info',
        span: 1,
      };
    default:
      return null;
  }
}

export default FormLayoutDesigner;
