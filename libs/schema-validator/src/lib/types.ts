/**
 * Schema Validator Types
 * HubbleWave Platform - Phase 2
 *
 * Type definitions for schema validation.
 */

import type { PropertyType as SharedPropertyType } from '@hubblewave/shared-types';

export type PropertyType = SharedPropertyType;

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface PropertyDefinition {
  code: string;
  name: string;
  type: PropertyType;
  isRequired?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  defaultValue?: unknown;
  config?: PropertyConfig;
}

export interface PropertyConfig {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  precision?: number;
  scale?: number;
  pattern?: string;
  choices?: ChoiceOption[];
  referenceCollection?: string;
  referenceDisplayProperty?: string;
  formula?: string;
  rollupConfig?: RollupConfig;
  lookupConfig?: LookupConfig;
  hierarchyConfig?: HierarchyConfig;
  geolocationConfig?: GeolocationConfig;
  durationConfig?: DurationConfig;
  fileConfig?: FileConfig;
}

export interface ChoiceOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface RollupConfig {
  sourceCollection: string;
  relationProperty: string;
  aggregateProperty: string;
  aggregation: AggregationType;
  filter?: Record<string, unknown>;
}

export interface LookupConfig {
  sourceCollection: string;
  referenceProperty: string;
  sourceProperty: string;
}

export interface HierarchyConfig {
  maxDepth?: number;
  allowMultipleRoots?: boolean;
  pathSeparator?: string;
}

export interface GeolocationConfig {
  defaultZoom?: number;
  defaultCenter?: { lat: number; lng: number };
  geocodingEnabled?: boolean;
}

export interface DurationConfig {
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  displayFormat?: string;
  minValue?: number;
  maxValue?: number;
}

export interface FileConfig {
  allowedTypes?: string[];
  maxSize?: number;
  maxFiles?: number;
}

export interface CollectionDefinition {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  properties: PropertyDefinition[];
  indexes?: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  properties: string[];
  isUnique?: boolean;
}

export interface RelationshipDefinition {
  name: string;
  sourceCollection: string;
  sourceProperty: string;
  targetCollection: string;
  targetProperty?: string;
  type: 'one_to_one' | 'one_to_many' | 'many_to_many';
  onDelete?: 'cascade' | 'set_null' | 'restrict';
}

export interface SchemaContext {
  collections: Map<string, CollectionDefinition>;
  relationships: RelationshipDefinition[];
}
