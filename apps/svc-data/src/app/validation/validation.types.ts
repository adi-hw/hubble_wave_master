/**
 * Validation Types for Schema Engine
 *
 * Defines the validation rule structures and result types
 * for property-level validation.
 */

/**
 * Validation rule types supported by the system
 */
export type ValidationRuleType =
  | 'required'
  | 'type'
  | 'unique'
  | 'regex'
  | 'min'
  | 'max'
  | 'min_length'
  | 'max_length'
  | 'range'
  | 'email'
  | 'url'
  | 'phone'
  | 'custom';

/**
 * Base validation rule interface
 */
export interface ValidationRule {
  type: ValidationRuleType;
  message?: string; // Custom error message
  enabled?: boolean; // Default true
}

/**
 * Required field validation
 */
export interface RequiredRule extends ValidationRule {
  type: 'required';
}

/**
 * Regex pattern validation
 */
export interface RegexRule extends ValidationRule {
  type: 'regex';
  pattern: string;
  flags?: string; // Regex flags (i, g, m, etc.)
}

/**
 * Minimum value validation (for numbers)
 */
export interface MinRule extends ValidationRule {
  type: 'min';
  value: number;
  inclusive?: boolean; // Default true
}

/**
 * Maximum value validation (for numbers)
 */
export interface MaxRule extends ValidationRule {
  type: 'max';
  value: number;
  inclusive?: boolean; // Default true
}

/**
 * Minimum length validation (for strings)
 */
export interface MinLengthRule extends ValidationRule {
  type: 'min_length';
  length: number;
}

/**
 * Maximum length validation (for strings)
 */
export interface MaxLengthRule extends ValidationRule {
  type: 'max_length';
  length: number;
}

/**
 * Range validation (for numbers or dates)
 */
export interface RangeRule extends ValidationRule {
  type: 'range';
  min?: number | string; // String for dates
  max?: number | string;
  minInclusive?: boolean; // Default true
  maxInclusive?: boolean; // Default true
}

/**
 * Email format validation
 */
export interface EmailRule extends ValidationRule {
  type: 'email';
}

/**
 * URL format validation
 */
export interface UrlRule extends ValidationRule {
  type: 'url';
  protocols?: string[]; // Allowed protocols, default ['http', 'https']
}

/**
 * Phone number format validation
 */
export interface PhoneRule extends ValidationRule {
  type: 'phone';
  format?: 'international' | 'us' | 'any'; // Default 'any'
}

/**
 * Custom script-based validation
 */
export interface CustomRule extends ValidationRule {
  type: 'custom';
  script: string; // JavaScript expression that returns boolean
  scriptId?: string; // Reference to PlatformScript for complex validation
}

/**
 * Union type for all validation rules
 */
export type AnyValidationRule =
  | RequiredRule
  | RegexRule
  | MinRule
  | MaxRule
  | MinLengthRule
  | MaxLengthRule
  | RangeRule
  | EmailRule
  | UrlRule
  | PhoneRule
  | CustomRule;

/**
 * Validation rules configuration for a property
 */
export interface PropertyValidationRules {
  rules: AnyValidationRule[];
}

/**
 * Result of a single validation rule check
 */
export interface ValidationRuleResult {
  rule: ValidationRuleType;
  passed: boolean;
  message?: string;
}

/**
 * Result of validating a single property
 */
export interface PropertyValidationResult {
  property: string;
  propertyLabel: string;
  isValid: boolean;
  errors: ValidationRuleResult[];
}

/**
 * Result of validating an entire record
 */
export interface RecordValidationResult {
  isValid: boolean;
  properties: PropertyValidationResult[];
  summary: {
    totalProperties: number;
    validProperties: number;
    invalidProperties: number;
    errorCount: number;
  };
}

/**
 * Validation context passed to validators
 */
export interface ValidationContext {
  record: Record<string, unknown>;
  existingRecord?: Record<string, unknown>; // For updates
  userId: string;
  collectionCode: string;
  isCreate: boolean;
}
