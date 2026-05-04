import {
  DesignerLayout,
  DesignerProperty,
  DesignerSection,
  DesignerTab,
  VisibilityCondition,
  VisibilityRule,
  generateId,
} from './types';
import type {
  Condition,
  ConditionOperator as RuntimeConditionOperator,
} from '@hubblewave/shared-types/condition-evaluator';

/**
 * Per-field overrides set in the designer that the runtime renderer
 * honors. Without these, a designer-set span=2 / helpText / labelOverride
 * would not survive the projection to the runtime layout shape.
 */
export interface SimpleFormField {
  /** Property code from PropertyDefinition. */
  code: string;
  /** Override the property's default label. */
  labelOverride?: string;
  /** Form-time placeholder text. */
  placeholder?: string;
  /** Help text shown beneath the input. */
  helpText?: string;
  /** Force read-only at form runtime regardless of property default. */
  readOnly?: boolean;
  /** Column span (1–4). Defaults to 1 if absent. */
  span?: 1 | 2 | 3 | 4;
}

export interface SimpleFormSection {
  id: string;
  label?: string;
  columns?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /**
   * Rich field projection. The legacy `string[]` shape is kept as a
   * fallback for older payloads but the renderer should prefer
   * `fieldDetails` when present.
   */
  fields: string[];
  fieldDetails?: SimpleFormField[];
}

export interface SimpleFormTab {
  id: string;
  label: string;
  icon?: string;
  sections: SimpleFormSection[];
}

/**
 * Inline DisplayRule extracted from a designer-set tab/section
 * `visibilityCondition`. The runtime evaluator treats these the same
 * as authored DisplayRule rows, so a designer can hide a whole
 * section "when state == closed" without leaving the form-builder
 * surface. Without this projection, designer-set conditions never
 * reach the runtime since SimpleFormLayout has no visibility column.
 */
export interface InlineDisplayRule {
  id: string;
  /** Runtime condition translated from the designer VisibilityCondition. */
  condition: Condition;
  /** All field codes contained under the conditional tab/section. */
  fieldCodes: string[];
}

export interface SimpleFormLayout {
  tabs: SimpleFormTab[];
  /** Designer-set tab/section visibility rules projected for runtime. */
  inlineDisplayRules?: InlineDisplayRule[];
}

const clampColumns = (columns?: number): 1 | 2 | 3 | 4 => {
  const value = Math.min(4, Math.max(1, columns || 2));
  if (value === 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 4;
};

/**
 * Translate a designer `VisibilityCondition` (rules + and/or operator,
 * possibly nested) into the runtime `Condition` shape (and/or arrays
 * of single conditions). Returns null when there are no rules to
 * evaluate (treated as always-visible).
 */
const toRuntimeCondition = (cond: VisibilityCondition | undefined): Condition | null => {
  if (!cond) return null;
  const ruleConditions: Condition[] = (cond.rules ?? []).map((rule: VisibilityRule) => ({
    property: rule.field,
    operator: rule.operator as RuntimeConditionOperator,
    value: rule.value,
  }));
  const nested: Condition[] = (cond.nestedConditions ?? [])
    .map(toRuntimeCondition)
    .filter((c): c is Condition => c != null);
  const all = [...ruleConditions, ...nested];
  if (all.length === 0) return null;
  return cond.operator === 'or' ? { or: all } : { and: all };
};

const collectFieldCodes = (items: DesignerSection['items']): string[] =>
  items
    .filter((item): item is DesignerProperty => item.type === 'property')
    .map((item) => item.propertyCode);

const extractInlineDisplayRules = (layout: DesignerLayout): InlineDisplayRule[] => {
  const rules: InlineDisplayRule[] = [];
  const pushIfConditional = (
    condition: VisibilityCondition | undefined,
    fieldCodes: string[],
  ) => {
    const runtime = toRuntimeCondition(condition);
    if (!runtime || fieldCodes.length === 0) return;
    rules.push({ id: generateId(), condition: runtime, fieldCodes });
  };

  layout.tabs.forEach((tab: DesignerTab) => {
    const tabFieldCodes = tab.sections.flatMap((s) => collectFieldCodes(s.items));
    pushIfConditional(tab.visibilityCondition, tabFieldCodes);
    tab.sections.forEach((section) => {
      pushIfConditional(section.visibilityCondition, collectFieldCodes(section.items));
    });
  });

  return rules;
};

/**
 * Project a rich DesignerLayout down to the simplified runtime shape.
 * `fields: string[]` stays for backward compatibility; the new
 * `fieldDetails` carries every per-field override (label, placeholder,
 * helpText, readOnly, span) so the runtime renderer can apply them.
 * Inline visibility conditions on tabs/sections are extracted into
 * `inlineDisplayRules` so the runtime evaluator processes them
 * alongside DisplayRules.
 */
export const toSimpleFormLayout = (layout: DesignerLayout): SimpleFormLayout => ({
  inlineDisplayRules: extractInlineDisplayRules(layout),
  tabs: layout.tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon,
    sections: tab.sections.map((section) => {
      const propertyItems = section.items.filter(
        (item): item is DesignerProperty => item.type === 'property',
      );
      return {
        id: section.id,
        label: section.label,
        columns: section.columns,
        collapsible: section.collapsible ?? false,
        defaultCollapsed: section.defaultCollapsed ?? false,
        fields: propertyItems.map((item) => item.propertyCode),
        fieldDetails: propertyItems.map((item) => ({
          code: item.propertyCode,
          labelOverride: item.labelOverride,
          placeholder: item.placeholder,
          helpText: item.helpText,
          readOnly: item.readOnly,
          span: item.span,
        })),
      };
    }),
  })),
});

/**
 * Reconstruct a DesignerLayout from a SimpleFormLayout. Prefers
 * `fieldDetails` (where labelOverride, placeholder, helpText,
 * readOnly, span live) over the legacy `fields: string[]`, so a
 * fallback-only payload still produces a valid designer tree.
 */
export const toDesignerLayout = (layout: SimpleFormLayout): DesignerLayout => ({
  version: 2,
  tabs: (layout.tabs || []).map((tab, tabIdx) => ({
    id: tab.id || `tab-${tabIdx}`,
    label: tab.label || `Tab ${tabIdx + 1}`,
    icon: tab.icon || 'layers',
    sections: (tab.sections || []).map((section, secIdx) => {
      const detailsByCode = new Map(
        (section.fieldDetails ?? []).map((d) => [d.code, d]),
      );
      const codes = (section.fields ?? section.fieldDetails?.map((d) => d.code) ?? []) as string[];
      return {
        id: section.id || `section-${tabIdx}-${secIdx}`,
        label: section.label,
        columns: clampColumns(section.columns),
        collapsible: section.collapsible ?? false,
        defaultCollapsed: section.defaultCollapsed ?? false,
        items: codes.map((propertyCode) => {
          const detail = detailsByCode.get(propertyCode);
          return {
            type: 'property' as const,
            id: generateId(),
            propertyCode,
            labelOverride: detail?.labelOverride,
            placeholder: detail?.placeholder,
            helpText: detail?.helpText,
            readOnly: detail?.readOnly,
            span: detail?.span ?? (1 as const),
          };
        }),
      };
    }),
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
