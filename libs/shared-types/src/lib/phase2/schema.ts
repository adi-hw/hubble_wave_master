/**
 * Phase 2 schema types.
 * Canonical property types live here with legacy aliases for normalization.
 */

export const CANONICAL_PROPERTY_TYPES = [
  'text',
  'number',
  'date',
  'datetime',
  'boolean',
  'choice',
  'multi-choice',
  'reference',
  'multi-reference',
  'user',
  'multi-user',
  'attachment',
  'rich-text',
  'formula',
  'rollup',
  'lookup',
  'geolocation',
  'duration',
  'currency',
  'json',
  'hierarchical',
] as const;

export type CanonicalPropertyType = (typeof CANONICAL_PROPERTY_TYPES)[number];

export const LEGACY_PROPERTY_TYPES = [
  'string',
  'rich_text',
  'longtext',
  'integer',
  'long',
  'decimal',
  'percent',
  'time',
  'multi_choice',
  'tags',
  'multi_reference',
  'user_reference',
  'group_reference',
  'multi_user',
  'file',
  'image',
  'audio',
  'video',
  'email',
  'phone',
  'url',
  'ip_address',
  'mac_address',
  'color',
  'key_value',
  'auto_number',
  'guid',
  'password_hashed',
  'secret_encrypted',
  'domain_scope',
  'condition',
  'script_ref',
  'process_flow_stage',
  'translated_string',
  'translated_rich_text',
  'geo_point',
  'location_reference',
] as const;

export type LegacyPropertyType = (typeof LEGACY_PROPERTY_TYPES)[number];

export type PropertyType = CanonicalPropertyType | LegacyPropertyType;

export const LEGACY_PROPERTY_TYPE_ALIASES: Record<LegacyPropertyType, CanonicalPropertyType> = {
  string: 'text',
  rich_text: 'rich-text',
  longtext: 'text',
  integer: 'number',
  long: 'number',
  decimal: 'number',
  percent: 'number',
  time: 'datetime',
  multi_choice: 'multi-choice',
  tags: 'multi-choice',
  multi_reference: 'multi-reference',
  user_reference: 'user',
  group_reference: 'reference',
  multi_user: 'multi-user',
  file: 'attachment',
  image: 'attachment',
  audio: 'attachment',
  video: 'attachment',
  email: 'text',
  phone: 'text',
  url: 'text',
  ip_address: 'text',
  mac_address: 'text',
  color: 'text',
  key_value: 'json',
  auto_number: 'number',
  guid: 'text',
  password_hashed: 'text',
  secret_encrypted: 'text',
  domain_scope: 'text',
  condition: 'json',
  script_ref: 'text',
  process_flow_stage: 'text',
  translated_string: 'text',
  translated_rich_text: 'rich-text',
  geo_point: 'geolocation',
  location_reference: 'reference',
};

export const ALL_PROPERTY_TYPES = [
  ...CANONICAL_PROPERTY_TYPES,
  ...LEGACY_PROPERTY_TYPES,
] as const;

export const isCanonicalPropertyType = (value: PropertyType): value is CanonicalPropertyType =>
  (CANONICAL_PROPERTY_TYPES as readonly string[]).includes(value);

export const isLegacyPropertyType = (value: PropertyType): value is LegacyPropertyType =>
  (LEGACY_PROPERTY_TYPES as readonly string[]).includes(value);

export const normalizePropertyType = (value: PropertyType): CanonicalPropertyType => {
  if (isCanonicalPropertyType(value)) return value;
  return LEGACY_PROPERTY_TYPE_ALIASES[value];
};

export type PropertyValidationType =
  | 'required'
  | 'pattern'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'custom';

export interface ValidationRule {
  type: PropertyValidationType;
  value?: unknown;
  message?: string;
}

export interface PropertyUIConfig {
  widget?: string;
  placeholder?: string;
  helpText?: string;
  icon?: string;
  color?: string;
  width?: 'full' | 'half' | 'third' | 'quarter';
}

export interface PropertyDependency {
  property: string;
  type: 'formula' | 'rollup' | 'lookup' | 'reference' | 'conditional' | 'other';
}

export interface PropertyPermissions {
  read?: string[];
  write?: string[];
  admin?: string[];
}

export interface ChoiceOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface SchemaPropertyDefinition {
  id?: string;
  code?: string;
  name: string;
  displayName?: string;
  label?: string;
  type: PropertyType;
  description?: string;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
  validation?: ValidationRule[];
  ui?: PropertyUIConfig;
  typeConfig?: PropertyTypeConfig;
  dependencies?: PropertyDependency[];
  permissions?: PropertyPermissions;
}

export interface TextPropertyConfig {
  type: 'text' | 'rich-text';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multiline?: boolean;
}

export interface NumberPropertyConfig {
  type: 'number';
  minValue?: number;
  maxValue?: number;
  precision?: number;
  scale?: number;
  format?: 'number' | 'currency' | 'percent';
}

export interface DatePropertyConfig {
  type: 'date' | 'datetime';
  format?: string;
  includeTime?: boolean;
}

export interface BooleanPropertyConfig {
  type: 'boolean';
}

export interface ChoicePropertyConfig {
  type: 'choice' | 'multi-choice';
  options?: ChoiceOption[];
  listId?: string;
  allowCustom?: boolean;
  defaultValue?: string | string[];
}

export interface ReferencePropertyConfig {
  type: 'reference' | 'multi-reference' | 'user' | 'multi-user';
  referenceCollection?: string;
  referenceDisplayProperty?: string;
  allowCreate?: boolean;
}

export interface AttachmentPropertyConfig {
  type: 'attachment';
  allowedTypes?: string[];
  maxSize?: number;
  maxFiles?: number;
}

export interface FormulaPropertyConfig {
  type: 'formula';
  formula: string;
  resultType: 'text' | 'number' | 'date' | 'boolean';
  dependencies: string[];
  cacheStrategy: 'never' | 'on_save' | 'periodic';
  cacheTtl?: number;
}

export interface RollupPropertyConfig {
  type: 'rollup';
  sourceCollection: string;
  sourceProperty: string;
  relationshipProperty?: string;
  relationProperty?: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'concat';
  filter?: Record<string, unknown>;
}

export interface LookupPropertyConfig {
  type: 'lookup';
  sourceReference?: string;
  targetProperty?: string;
  sourceCollection?: string;
  referenceProperty?: string;
  sourceProperty?: string;
}

export interface GeolocationPropertyConfig {
  type: 'geolocation';
  format: 'coordinates' | 'address' | 'both';
  defaultMapZoom?: number;
  defaultCenter?: { lat: number; lng: number };
  geocodingEnabled?: boolean;
}

export interface DurationPropertyConfig {
  type: 'duration';
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  displayFormat: 'short' | 'long' | 'decimal';
  allowNegative?: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface CurrencyPropertyConfig {
  type: 'currency';
  currencyProperty?: string;
  defaultCurrency: string;
  precision: number;
  allowedCurrencies?: string[];
}

export interface JsonPropertyConfig {
  type: 'json';
  schema?: Record<string, unknown>;
}

export interface HierarchicalPropertyConfig {
  type: 'hierarchical';
  parentProperty: string;
  maxDepth?: number;
  orderProperty?: string;
}

export type PropertyTypeConfig =
  | TextPropertyConfig
  | NumberPropertyConfig
  | DatePropertyConfig
  | BooleanPropertyConfig
  | ChoicePropertyConfig
  | ReferencePropertyConfig
  | AttachmentPropertyConfig
  | FormulaPropertyConfig
  | RollupPropertyConfig
  | LookupPropertyConfig
  | GeolocationPropertyConfig
  | DurationPropertyConfig
  | CurrencyPropertyConfig
  | JsonPropertyConfig
  | HierarchicalPropertyConfig;
