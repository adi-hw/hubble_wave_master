/**
 * Property Type Definitions
 * Canonical set of property types used by UI and backend for collection property definitions.
 */
import type { PropertyType } from './phase2/schema';

export interface PropertyOption {
  value: string;
  label: string;
}

export interface PropertyDefinition<TConfig = unknown, TValidators = unknown> {
  name: string;
  label: string;
  type: PropertyType;
  required: boolean;
  defaultValue?: unknown;
  config?: TConfig;
  validators?: TValidators;
  isIndexed?: boolean;
  options?: PropertyOption[];
}
