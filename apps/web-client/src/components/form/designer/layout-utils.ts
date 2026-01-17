import { DesignerLayout, DesignerProperty, generateId } from './types';

export interface SimpleFormSection {
  id: string;
  label?: string;
  columns?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: string[];
}

export interface SimpleFormTab {
  id: string;
  label: string;
  icon?: string;
  sections: SimpleFormSection[];
}

export interface SimpleFormLayout {
  tabs: SimpleFormTab[];
}

const clampColumns = (columns?: number): 1 | 2 | 3 | 4 => {
  const value = Math.min(4, Math.max(1, columns || 2));
  if (value === 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 4;
};

export const toSimpleFormLayout = (layout: DesignerLayout): SimpleFormLayout => ({
  tabs: layout.tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon,
    sections: tab.sections.map((section) => ({
      id: section.id,
      label: section.label,
      columns: section.columns,
      collapsible: section.collapsible ?? false,
      defaultCollapsed: section.defaultCollapsed ?? false,
      fields: section.items
        .filter((item): item is DesignerProperty => item.type === 'property')
        .map((item) => item.propertyCode),
    })),
  })),
});

export const toDesignerLayout = (layout: SimpleFormLayout): DesignerLayout => ({
  version: 2,
  tabs: (layout.tabs || []).map((tab, tabIdx) => ({
    id: tab.id || `tab-${tabIdx}`,
    label: tab.label || `Tab ${tabIdx + 1}`,
    icon: tab.icon || 'layers',
    sections: (tab.sections || []).map((section, secIdx) => ({
      id: section.id || `section-${tabIdx}-${secIdx}`,
      label: section.label,
      columns: clampColumns(section.columns),
      collapsible: section.collapsible ?? false,
      defaultCollapsed: section.defaultCollapsed ?? false,
      items: (section.fields || []).map((propertyCode) => ({
        type: 'property' as const,
        id: generateId(),
        propertyCode,
        span: 1 as const,
      })),
    })),
  })),
});

export const buildDefaultDesignerLayout = (
  fields: Array<{ code: string }>
): DesignerLayout => ({
  version: 2,
  tabs: [
    {
      id: generateId(),
      label: 'Details',
      icon: 'file-text',
      sections: [
        {
          id: generateId(),
          label: 'General Information',
          columns: 2,
          items: fields.map((field) => ({
            type: 'property' as const,
            id: generateId(),
            propertyCode: field.code,
            span: 1 as const,
          })),
        },
      ],
    },
  ],
});
