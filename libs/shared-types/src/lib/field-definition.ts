// Canonical set used by UI + backend model_field_type codes
export type FieldType =
  | 'string'
  | 'text'
  | 'rich_text'
  | 'number'
  | 'integer'
  | 'long'
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'duration'
  | 'choice'
  | 'multi_choice'
  | 'tags'
  | 'reference'
  | 'multi_reference'
  | 'user_reference'
  | 'file'
  | 'image'
  | 'json'
  | 'email'
  | 'phone'
  | 'url'
  | 'auto_number'
  | 'guid';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDefinition<TConfig = unknown, TValidators = unknown> {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  config?: TConfig;
  validators?: TValidators;
  isIndexed?: boolean;
  options?: FieldOption[];
}
