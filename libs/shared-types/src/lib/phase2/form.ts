/**
 * Phase 2 form builder configuration types.
 */

export type FormType = 'create' | 'edit' | 'view' | 'wizard';

export interface FormConfiguration {
  id: string;
  name: string;
  collectionId: string;
  type: FormType;
  layout: FormLayout;
  sections: FormSection[];
  validation?: FormValidation;
  conditionalLogic?: ConditionalRule[];
  permissions?: FormPermissions;
  styling?: FormStyling;
}

export interface FormLayout {
  type: 'single-column' | 'two-column' | 'responsive-grid';
  gridConfig?: GridConfig;
  maxWidth?: string;
  padding?: string;
}

export interface GridConfig {
  columns?: number;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsible: boolean;
  defaultCollapsed: boolean;
  fields: FormField[];
  condition?: ConditionalRule;
  layout?: 'vertical' | 'horizontal' | 'grid';
  gridColumns?: number;
}

export interface FormField {
  id: string;
  propertyName: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  readonly: boolean;
  hidden: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  widget?: WidgetConfig;
  validation?: FieldValidation[];
  condition?: ConditionalRule;
}

export interface WidgetConfig {
  type: string;
  options?: Record<string, unknown>;
}

export interface ConditionalRule {
  conditions: ConditionGroup;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional' | 'set-value';
  value?: unknown;
}

export interface ConditionGroup {
  operator: 'and' | 'or';
  conditions: Array<FieldCondition | ConditionGroup>;
}

export interface FieldCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'not-empty';
  value?: unknown;
}

export interface FieldValidation {
  type: 'required' | 'pattern' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom';
  value?: unknown;
  message: string;
}

export interface FormValidation {
  mode?: 'onSubmit' | 'onBlur' | 'onChange';
  rules?: FieldValidation[];
}

export interface FormPermissions {
  read?: string[];
  write?: string[];
  admin?: string[];
}

export interface FormStyling {
  density?: 'compact' | 'comfortable' | 'spacious';
  showSectionBorders?: boolean;
  background?: string;
}
