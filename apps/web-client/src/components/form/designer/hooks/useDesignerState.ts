import { useReducer, useCallback, useMemo } from 'react';
import {
  DesignerLayout,
  DesignerState,
  DesignerAction,
  DesignerItem,
  DesignerSection,
  DesignerTab,
  ItemLocation,
  createEmptyLayout,
} from '../types';

const MAX_HISTORY_SIZE = 50;

function cloneLayout(layout: DesignerLayout): DesignerLayout {
  return JSON.parse(JSON.stringify(layout));
}

function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  const addToHistory = (newLayout: DesignerLayout): DesignerState => {
    // Trim future history if we're not at the end
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(cloneLayout(newLayout));

    // Keep history under max size
    if (history.length > MAX_HISTORY_SIZE) {
      history.shift();
    }

    return {
      ...state,
      layout: newLayout,
      isDirty: true,
      history,
      historyIndex: history.length - 1,
    };
  };

  switch (action.type) {
    case 'SET_LAYOUT': {
      return {
        ...state,
        layout: action.payload,
        isDirty: false,
        history: [cloneLayout(action.payload)],
        historyIndex: 0,
      };
    }

    case 'SELECT_ITEM': {
      return {
        ...state,
        selectedItemId: action.payload.id,
        selectedItemType: action.payload.type,
      };
    }

    case 'UPDATE_ITEM': {
      const { id, updates } = action.payload;
      const newLayout = cloneLayout(state.layout);

      for (const tab of newLayout.tabs) {
        for (const section of tab.sections) {
          const itemIndex = section.items.findIndex((item) => item.id === id);
          if (itemIndex !== -1) {
            section.items[itemIndex] = {
              ...section.items[itemIndex],
              ...updates,
            } as DesignerItem;
            return addToHistory(newLayout);
          }
        }
      }
      return state;
    }

    case 'ADD_ITEM': {
      const { item, location } = action.payload;
      const newLayout = cloneLayout(state.layout);

      const tab = newLayout.tabs.find((t) => t.id === location.tabId);
      if (!tab) return state;

      const section = tab.sections.find((s) => s.id === location.sectionId);
      if (!section) return state;

      section.items.splice(location.index, 0, item);
      return addToHistory(newLayout);
    }

    case 'REMOVE_ITEM': {
      const { id } = action.payload;
      const newLayout = cloneLayout(state.layout);

      for (const tab of newLayout.tabs) {
        for (const section of tab.sections) {
          const itemIndex = section.items.findIndex((item) => item.id === id);
          if (itemIndex !== -1) {
            section.items.splice(itemIndex, 1);
            return addToHistory(newLayout);
          }
        }
      }
      return state;
    }

    case 'MOVE_ITEM': {
      const { itemId, targetLocation } = action.payload;
      const newLayout = cloneLayout(state.layout);

      // Find and remove item from current location
      let movedItem: DesignerItem | null = null;
      for (const tab of newLayout.tabs) {
        for (const section of tab.sections) {
          const itemIndex = section.items.findIndex((item) => item.id === itemId);
          if (itemIndex !== -1) {
            [movedItem] = section.items.splice(itemIndex, 1);
            break;
          }
        }
        if (movedItem) break;
      }

      if (!movedItem) return state;

      // Add to target location
      const targetTab = newLayout.tabs.find((t) => t.id === targetLocation.tabId);
      if (!targetTab) return state;

      const targetSection = targetTab.sections.find((s) => s.id === targetLocation.sectionId);
      if (!targetSection) return state;

      targetSection.items.splice(targetLocation.index, 0, movedItem);
      return addToHistory(newLayout);
    }

    case 'ADD_SECTION': {
      const { section, tabId, index } = action.payload;
      const newLayout = cloneLayout(state.layout);

      const tab = newLayout.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const insertIndex = index ?? tab.sections.length;
      tab.sections.splice(insertIndex, 0, section);
      return addToHistory(newLayout);
    }

    case 'UPDATE_SECTION': {
      const { id, updates } = action.payload;
      const newLayout = cloneLayout(state.layout);

      for (const tab of newLayout.tabs) {
        const sectionIndex = tab.sections.findIndex((s) => s.id === id);
        if (sectionIndex !== -1) {
          tab.sections[sectionIndex] = {
            ...tab.sections[sectionIndex],
            ...updates,
          };
          return addToHistory(newLayout);
        }
      }
      return state;
    }

    case 'REMOVE_SECTION': {
      const { id } = action.payload;
      const newLayout = cloneLayout(state.layout);

      for (const tab of newLayout.tabs) {
        const sectionIndex = tab.sections.findIndex((s) => s.id === id);
        if (sectionIndex !== -1) {
          // Don't remove if it's the last section in the tab
          if (tab.sections.length === 1) {
            // Instead, clear the items
            tab.sections[sectionIndex].items = [];
          } else {
            tab.sections.splice(sectionIndex, 1);
          }
          return addToHistory(newLayout);
        }
      }
      return state;
    }

    case 'MOVE_SECTION': {
      const { sectionId, tabId, index } = action.payload;
      const newLayout = cloneLayout(state.layout);

      // Find and remove section from current location
      let movedSection: DesignerSection | null = null;
      for (const tab of newLayout.tabs) {
        const sectionIndex = tab.sections.findIndex((s) => s.id === sectionId);
        if (sectionIndex !== -1) {
          [movedSection] = tab.sections.splice(sectionIndex, 1);
          break;
        }
      }

      if (!movedSection) return state;

      // Add to target location
      const targetTab = newLayout.tabs.find((t) => t.id === tabId);
      if (!targetTab) return state;

      targetTab.sections.splice(index, 0, movedSection);
      return addToHistory(newLayout);
    }

    case 'ADD_TAB': {
      const { tab, index } = action.payload;
      const newLayout = cloneLayout(state.layout);

      const insertIndex = index ?? newLayout.tabs.length;
      newLayout.tabs.splice(insertIndex, 0, tab);
      return addToHistory(newLayout);
    }

    case 'UPDATE_TAB': {
      const { id, updates } = action.payload;
      const newLayout = cloneLayout(state.layout);

      const tabIndex = newLayout.tabs.findIndex((t) => t.id === id);
      if (tabIndex !== -1) {
        newLayout.tabs[tabIndex] = {
          ...newLayout.tabs[tabIndex],
          ...updates,
        };
        return addToHistory(newLayout);
      }
      return state;
    }

    case 'REMOVE_TAB': {
      const { id } = action.payload;
      const newLayout = cloneLayout(state.layout);

      // Don't remove if it's the last tab
      if (newLayout.tabs.length === 1) {
        return state;
      }

      const tabIndex = newLayout.tabs.findIndex((t) => t.id === id);
      if (tabIndex !== -1) {
        newLayout.tabs.splice(tabIndex, 1);
        return addToHistory(newLayout);
      }
      return state;
    }

    case 'MOVE_TAB': {
      const { tabId, index } = action.payload;
      const newLayout = cloneLayout(state.layout);

      const tabIndex = newLayout.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1 || tabIndex === index) return state;

      const [movedTab] = newLayout.tabs.splice(tabIndex, 1);
      newLayout.tabs.splice(index, 0, movedTab);
      return addToHistory(newLayout);
    }

    case 'SET_DRAG_STATE': {
      return {
        ...state,
        dragState: action.payload,
      };
    }

    case 'SET_MODE': {
      return {
        ...state,
        mode: action.payload,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        layout: cloneLayout(state.history[newIndex]),
        historyIndex: newIndex,
        isDirty: newIndex !== 0,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        layout: cloneLayout(state.history[newIndex]),
        historyIndex: newIndex,
        isDirty: true,
      };
    }

    case 'RESET': {
      if (state.history.length === 0) return state;
      return {
        ...state,
        layout: cloneLayout(state.history[0]),
        historyIndex: 0,
        isDirty: false,
      };
    }

    default:
      return state;
  }
}

function createInitialState(initialLayout?: DesignerLayout): DesignerState {
  const layout = initialLayout || createEmptyLayout();
  return {
    layout,
    selectedItemId: null,
    selectedItemType: null,
    isDirty: false,
    history: [cloneLayout(layout)],
    historyIndex: 0,
    dragState: null,
    mode: 'edit',
  };
}

export function useDesignerState(initialLayout?: DesignerLayout) {
  const [state, dispatch] = useReducer(
    designerReducer,
    initialLayout,
    createInitialState
  );

  // Action creators
  const setLayout = useCallback((layout: DesignerLayout) => {
    dispatch({ type: 'SET_LAYOUT', payload: layout });
  }, []);

  const selectItem = useCallback((id: string | null, type: DesignerState['selectedItemType']) => {
    dispatch({ type: 'SELECT_ITEM', payload: { id, type } });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<DesignerItem>) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } });
  }, []);

  const addItem = useCallback((item: DesignerItem, location: ItemLocation) => {
    dispatch({ type: 'ADD_ITEM', payload: { item, location } });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, []);

  const moveItem = useCallback((itemId: string, targetLocation: ItemLocation) => {
    dispatch({ type: 'MOVE_ITEM', payload: { itemId, targetLocation } });
  }, []);

  const addSection = useCallback((section: DesignerSection, tabId: string, index?: number) => {
    dispatch({ type: 'ADD_SECTION', payload: { section, tabId, index } });
  }, []);

  const updateSection = useCallback((id: string, updates: Partial<DesignerSection>) => {
    dispatch({ type: 'UPDATE_SECTION', payload: { id, updates } });
  }, []);

  const removeSection = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SECTION', payload: { id } });
  }, []);

  const moveSection = useCallback((sectionId: string, tabId: string, index: number) => {
    dispatch({ type: 'MOVE_SECTION', payload: { sectionId, tabId, index } });
  }, []);

  const addTab = useCallback((tab: DesignerTab, index?: number) => {
    dispatch({ type: 'ADD_TAB', payload: { tab, index } });
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<DesignerTab>) => {
    dispatch({ type: 'UPDATE_TAB', payload: { id, updates } });
  }, []);

  const removeTab = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TAB', payload: { id } });
  }, []);

  const moveTab = useCallback((tabId: string, index: number) => {
    dispatch({ type: 'MOVE_TAB', payload: { tabId, index } });
  }, []);

  const setDragState = useCallback((dragState: DesignerState['dragState']) => {
    dispatch({ type: 'SET_DRAG_STATE', payload: dragState });
  }, []);

  const setMode = useCallback((mode: 'edit' | 'preview') => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Computed values
  const canUndo = useMemo(() => state.historyIndex > 0, [state.historyIndex]);
  const canRedo = useMemo(
    () => state.historyIndex < state.history.length - 1,
    [state.historyIndex, state.history.length]
  );

  const selectedItem = useMemo(() => {
    if (!state.selectedItemId) return null;
    for (const tab of state.layout.tabs) {
      for (const section of tab.sections) {
        const item = section.items.find((i) => i.id === state.selectedItemId);
        if (item) return item;
      }
    }
    return null;
  }, [state.layout, state.selectedItemId]);

  const selectedSection = useMemo(() => {
    if (!state.selectedItemId || state.selectedItemType !== 'section') return null;
    for (const tab of state.layout.tabs) {
      const section = tab.sections.find((s) => s.id === state.selectedItemId);
      if (section) return section;
    }
    return null;
  }, [state.layout, state.selectedItemId, state.selectedItemType]);

  const selectedTab = useMemo(() => {
    if (!state.selectedItemId || state.selectedItemType !== 'tab') return null;
    return state.layout.tabs.find((t) => t.id === state.selectedItemId) || null;
  }, [state.layout, state.selectedItemId, state.selectedItemType]);

  // Get all property codes currently in the layout
  const propertiesInLayout = useMemo(() => {
    const propertyCodes = new Set<string>();
    for (const tab of state.layout.tabs) {
      for (const section of tab.sections) {
        for (const item of section.items) {
          if (item.type === 'property') {
            propertyCodes.add(item.propertyCode);
          } else if (item.type === 'dot_walk') {
            propertyCodes.add(`${item.basePath}.${item.propertyCode}`);
          } else if (item.type === 'group') {
            for (const property of item.properties) {
              if (property.type === 'property') {
                propertyCodes.add(property.propertyCode);
              }
            }
          }
        }
      }
    }
    return propertyCodes;
  }, [state.layout]);

  return {
    // State
    layout: state.layout,
    selectedItemId: state.selectedItemId,
    selectedItemType: state.selectedItemType,
    isDirty: state.isDirty,
    dragState: state.dragState,
    mode: state.mode,

    // Computed
    canUndo,
    canRedo,
    selectedItem,
    selectedSection,
    selectedTab,
    propertiesInLayout,

    // Actions
    setLayout,
    selectItem,
    updateItem,
    addItem,
    removeItem,
    moveItem,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addTab,
    updateTab,
    removeTab,
    moveTab,
    setDragState,
    setMode,
    undo,
    redo,
    reset,
  };
}

export type UseDesignerStateReturn = ReturnType<typeof useDesignerState>;
