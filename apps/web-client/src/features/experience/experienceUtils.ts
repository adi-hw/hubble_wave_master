import type { DesignerLayout } from '../../components/form/designer/types';
import {
  SimpleFormLayout,
  buildDefaultDesignerLayout,
  toSimpleFormLayout,
} from '../../components/form/designer/layout-utils';
import type { ResolvedView } from '../../services/viewApi';

export type SchemaProperty = {
  id: string;
  code: string;
  name?: string;
  label?: string;
  dataType?: string;
  propertyType?: { code?: string; name?: string };
  config?: {
    dataType?: string;
    choices?: Array<{ value: string; label: string; color?: string }>;
    widget?: string;
    [key: string]: unknown;
  };
  isRequired?: boolean;
  isUnique?: boolean;
  defaultValue?: unknown;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  referenceCollectionCode?: string;
  referenceDisplayProperty?: string;
};

export const getPropertyDataType = (prop: SchemaProperty): string => {
  return prop.dataType || prop.propertyType?.code || (prop.config?.dataType as string) || 'text';
};

export const extractListColumns = (view?: ResolvedView | null): string[] => {
  if (!view?.layout || typeof view.layout !== 'object') return [];
  const layout = view.layout as Record<string, unknown>;
  const columns =
    (layout.columns as Array<Record<string, unknown>> | undefined) ||
    ((layout.list as Record<string, unknown> | undefined)?.columns as Array<Record<string, unknown>> | undefined) ||
    [];
  if (!Array.isArray(columns)) return [];
  return columns
    .filter((column) => column.visible !== false)
    .map((column) => (column.property_code || column.code) as string | undefined)
    .filter((code): code is string => Boolean(code));
};

export const resolveFormLayout = (
  view: ResolvedView | null,
  fallbackFields?: Array<{ code: string }>
): SimpleFormLayout | null => {
  if (!view?.layout || typeof view.layout !== 'object') {
    if (fallbackFields?.length) {
      return toSimpleFormLayout(buildDefaultDesignerLayout(fallbackFields));
    }
    return null;
  }

  const layoutPayload = view.layout as Record<string, unknown>;
  const designer = layoutPayload.designer as DesignerLayout | undefined;
  const formDesigner = layoutPayload.formLayout as DesignerLayout | undefined;

  if (designer?.version === 2) {
    return toSimpleFormLayout(designer);
  }
  if (formDesigner?.version === 2) {
    return toSimpleFormLayout(formDesigner);
  }

  const simpleLayout =
    (layoutPayload.layout as SimpleFormLayout | undefined) ||
    (layoutPayload.formLayout as SimpleFormLayout | undefined) ||
    (layoutPayload as unknown as SimpleFormLayout);

  if (simpleLayout?.tabs?.length) {
    return simpleLayout;
  }

  if (fallbackFields?.length) {
    return toSimpleFormLayout(buildDefaultDesignerLayout(fallbackFields));
  }

  return null;
};

export const extractFormFieldCodes = (layout: SimpleFormLayout | null): string[] => {
  if (!layout) return [];
  const codes: string[] = [];
  layout.tabs.forEach((tab) => {
    tab.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field && !codes.includes(field)) {
          codes.push(field);
        }
      });
    });
  });
  return codes;
};
