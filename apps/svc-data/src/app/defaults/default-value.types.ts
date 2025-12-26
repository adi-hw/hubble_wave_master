/**
 * Default Value Types for Schema Engine
 *
 * Defines the default value types and evaluation context
 * for property default values.
 */

/**
 * Supported default value types
 */
export type DefaultValueType =
  | 'static'          // Static value as-is
  | 'expression'      // JavaScript expression
  | 'script'          // Reference to PlatformScript
  | 'sequence'        // Auto-incrementing sequence
  | 'current_user'    // Current user's ID
  | 'current_datetime'// Current timestamp
  | 'current_date'    // Current date only
  | 'uuid'            // Generate new UUID
  | 'null';           // Explicit null

/**
 * Default value configuration stored in property
 */
export interface DefaultValueConfig {
  type: DefaultValueType;
  value?: string | number | boolean | null; // For static values
  expression?: string;  // For expression type
  scriptId?: string;    // For script type (reference to PlatformScript)
  sequenceCode?: string; // For sequence type (reference to sequence)
  format?: string;      // For sequence/datetime formatting
}

/**
 * Context passed to default value evaluators
 */
export interface DefaultValueContext {
  userId: string;
  userName?: string;
  userEmail?: string;
  collectionCode: string;
  collectionId: string;
  record: Record<string, unknown>; // Other fields in the record
  isCreate: boolean;
}

/**
 * Result of evaluating a default value
 */
export interface DefaultValueResult {
  success: boolean;
  value: unknown;
  error?: string;
}

/**
 * Sequence definition for auto-numbering
 */
export interface SequenceDefinition {
  code: string;
  name: string;
  prefix?: string;      // e.g., "WO-" for work orders
  suffix?: string;      // e.g., "-2025"
  padLength?: number;   // e.g., 5 for "00001"
  startValue?: number;  // Starting number
  incrementBy?: number; // Increment step (default 1)
  resetFrequency?: 'never' | 'daily' | 'monthly' | 'yearly';
  format?: string;      // Custom format pattern
}

/**
 * Sequence state (current values)
 */
export interface SequenceState {
  id: string;
  code: string;
  currentValue: number;
  lastResetDate?: Date;
  updatedAt: Date;
}
