/**
 * Context types for formula evaluation
 */

import { FormulaValue } from './types';

/**
 * Record data passed to formula evaluation
 */
export interface RecordData {
  [propertyCode: string]: FormulaValue;
}

/**
 * Related records for lookups and rollups
 */
export interface RelatedRecords {
  [collectionCode: string]: {
    [referenceId: string]: RecordData[];
  };
}

/**
 * Current user information for user-aware formulas
 */
export interface CurrentUser {
  id: string;
  username?: string;
  email?: string;
  roles?: string[];
  groups?: string[];
  timezone?: string;
}

/**
 * Collection metadata for type checking
 */
export interface CollectionMetadata {
  code: string;
  name: string;
  properties: PropertyMetadata[];
}

/**
 * Property metadata for validation
 */
export interface PropertyMetadata {
  code: string;
  name: string;
  propertyTypeCode: string;
  isRequired: boolean;
  typeConfig?: Record<string, unknown>;
}

/**
 * Context for formula evaluation
 */
export interface FormulaContext {
  /** Current record data */
  record: RecordData;
  /** Related records for lookups */
  relatedRecords?: RelatedRecords;
  /** Collection metadata */
  collections?: Record<string, CollectionMetadata>;
  /** Current user */
  currentUser?: CurrentUser;
  /** Current timestamp */
  now?: Date;
  /** Timezone for date calculations */
  timezone?: string;
  /** Custom variables */
  variables?: Record<string, FormulaValue>;
}

/**
 * Creates an empty formula context
 */
export function createEmptyContext(): FormulaContext {
  return {
    record: {},
    relatedRecords: {},
    collections: {},
    currentUser: undefined,
    now: new Date(),
    timezone: 'UTC',
    variables: {},
  };
}

/**
 * Merges two contexts, with the second taking precedence
 */
export function mergeContexts(base: FormulaContext, override: Partial<FormulaContext>): FormulaContext {
  return {
    record: { ...base.record, ...override.record },
    relatedRecords: { ...base.relatedRecords, ...override.relatedRecords },
    collections: { ...base.collections, ...override.collections },
    currentUser: override.currentUser ?? base.currentUser,
    now: override.now ?? base.now,
    timezone: override.timezone ?? base.timezone,
    variables: { ...base.variables, ...override.variables },
  };
}
