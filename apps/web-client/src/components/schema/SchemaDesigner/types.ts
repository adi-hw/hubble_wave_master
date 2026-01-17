/**
 * Schema Designer Types
 * HubbleWave Platform - Phase 2
 */

import type { PropertyType as SharedPropertyType } from '@hubblewave/shared-types';

export type PropertyType = SharedPropertyType;

export interface PropertyValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  custom?: string;
}

export interface PropertyConfig {
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  validators?: PropertyValidation;
  choices?: Array<{ value: string; label: string; color?: string }>;
  referenceCollection?: string;
  referenceDisplayProperty?: string;
  formula?: string;
  rollupConfig?: {
    relationProperty: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
    aggregateProperty: string;
  };
  lookupConfig?: {
    referenceProperty: string;
    sourceProperty: string;
  };
}

export interface SchemaProperty {
  id: string;
  code: string;
  name: string;
  type: PropertyType;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  system?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  description?: string;
  config?: PropertyConfig;
}

export interface SchemaCollection {
  id: string;
  code: string;
  name: string;
  description?: string;
  properties: SchemaProperty[];
  isSystem?: boolean;
  icon?: string;
  color?: string;
  singularName?: string;
  pluralName?: string;
}

export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export interface SchemaRelationship {
  id: string;
  name: string;
  sourceCollection: string;
  sourceProperty: string;
  targetCollection: string;
  targetProperty?: string;
  type: RelationshipType;
  cascadeDelete?: boolean;
  required?: boolean;
}
