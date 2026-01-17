import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Parser } from 'expr-eval';
import { PropertyDefinition } from '@hubblewave/instance-db';
import {
  isCanonicalPropertyType,
  isLegacyPropertyType,
  normalizePropertyType,
  type CanonicalPropertyType,
  type PropertyType,
} from '@hubblewave/shared-types';
import {
  AnyValidationRule,
  ValidationContext,
  PropertyValidationResult,
  RecordValidationResult,
  ValidationRuleResult,
  PropertyValidationRules,
  RegexRule,
  MinRule,
  MaxRule,
  MinLengthRule,
  MaxLengthRule,
  RangeRule,
  UrlRule,
  PhoneRule,
  CustomRule,
} from './validation.types';

/**
 * ValidationService - Validates record data against property validation rules
 *
 * Supports the following validation types:
 * - required: Field must have a value
 * - regex: Value must match a regex pattern
 * - min/max: Numeric value bounds
 * - min_length/max_length: String length bounds
 * - range: Value within a range (numbers or dates)
 * - email: Valid email format
 * - url: Valid URL format
 * - phone: Valid phone number format
 * - custom: Custom script-based validation
 */
/**
 * SECURITY: Blocked patterns in custom validation scripts
 */
const BLOCKED_PATTERNS = [
  /\beval\b/i,
  /\bFunction\b/i,
  /\bprocess\b/i,
  /\brequire\b/i,
  /\bimport\b/i,
  /\bglobal\b/i,
  /\bwindow\b/i,
  /\bdocument\b/i,
  /\bconstructor\b/i,
  /\b__proto__\b/i,
  /\bprototype\b/i,
  /\bthis\b/i,
  /\bnew\s+/i,
  /\bdelete\b/i,
  /\bfetch\b/i,
  /\bsetTimeout\b/i,
  /\bsetInterval\b/i,
  /\bPromise\b/i,
  /\basync\b/i,
  /\bawait\b/i,
];

/**
 * SECURITY: Safe functions for custom validation expressions
 */
const SAFE_VALIDATION_FUNCTIONS = {
  // String functions
  length: (s: unknown) => String(s ?? '').length,
  upper: (s: unknown) => String(s ?? '').toUpperCase(),
  lower: (s: unknown) => String(s ?? '').toLowerCase(),
  trim: (s: unknown) => String(s ?? '').trim(),
  startsWith: (s: unknown, prefix: string) => String(s ?? '').startsWith(prefix),
  endsWith: (s: unknown, suffix: string) => String(s ?? '').endsWith(suffix),
  contains: (s: unknown, search: string) => String(s ?? '').includes(search),
  matches: (s: unknown, pattern: string) => new RegExp(pattern).test(String(s ?? '')),

  // Type checking
  isNull: (v: unknown) => v === null || v === undefined,
  isEmpty: (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
  isNumber: (v: unknown) => typeof v === 'number' && !isNaN(v),
  isString: (v: unknown) => typeof v === 'string',
  isArray: (v: unknown) => Array.isArray(v),

  // Comparison helpers
  equals: (a: unknown, b: unknown) => a === b,
  notEquals: (a: unknown, b: unknown) => a !== b,

  // Array functions
  count: (arr: unknown) => Array.isArray(arr) ? arr.length : 0,
  includes: (arr: unknown, item: unknown) => Array.isArray(arr) ? arr.includes(item) : String(arr ?? '').includes(String(item)),

  // Math
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly safeParser: Parser;

  constructor() {
    // Initialize safe expression parser
    this.safeParser = new Parser({
      operators: {
        'in': false,
        assignment: false,
      },
    });

    // Register safe functions
    for (const [name, fn] of Object.entries(SAFE_VALIDATION_FUNCTIONS)) {
      this.safeParser.functions[name] = fn;
    }
  }

  /**
   * Validate script content for security
   */
  private validateScriptSecurity(script: string): void {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(script)) {
        throw new BadRequestException(
          `Validation script contains blocked pattern. Only safe expressions are allowed.`
        );
      }
    }

    if (script.length > 2000) {
      throw new BadRequestException('Validation script exceeds maximum length');
    }
  }

  /**
   * Validate a record against all property validation rules
   */
  async validateRecord(
    data: Record<string, unknown>,
    properties: PropertyDefinition[],
    context: ValidationContext
  ): Promise<RecordValidationResult> {
    const propertyResults: PropertyValidationResult[] = [];
    let totalErrors = 0;

    for (const property of properties) {
      const propertyResult = await this.validateProperty(
        property.code,
        property.name || property.code,
        data[property.code],
        property,
        context
      );

      propertyResults.push(propertyResult);
      totalErrors += propertyResult.errors.length;
    }

    const invalidProperties = propertyResults.filter((p) => !p.isValid);

    return {
      isValid: invalidProperties.length === 0,
      properties: propertyResults,
      summary: {
        totalProperties: properties.length,
        validProperties: properties.length - invalidProperties.length,
        invalidProperties: invalidProperties.length,
        errorCount: totalErrors,
      },
    };
  }

  /**
   * Validate a single property value
   */
  async validateProperty(
    propertyCode: string,
    propertyLabel: string,
    value: unknown,
    property: PropertyDefinition,
    context: ValidationContext
  ): Promise<PropertyValidationResult> {
    const errors: ValidationRuleResult[] = [];

    // Check required first (from property definition)
    if (property.isRequired) {
      const requiredResult = this.validateRequired(value, propertyLabel);
      if (!requiredResult.passed) {
        errors.push(requiredResult);
      }
    }

    const typeResult = this.validateDataType(value, propertyLabel, property);
    if (typeResult && !typeResult.passed) {
      errors.push(typeResult);
    }

    // Parse validation rules from property
    const rules = this.parseValidationRules(property);

    // Skip other validations if value is empty and not required
    if (this.isEmpty(value) && !property.isRequired) {
      return {
        property: propertyCode,
        propertyLabel,
        isValid: true,
        errors: [],
      };
    }

    // Run each validation rule
    for (const rule of rules) {
      if (rule.enabled === false) continue;

      const result = await this.validateRule(value, rule, propertyLabel, context);
      if (!result.passed) {
        errors.push(result);
      }
    }

    return {
      property: propertyCode,
      propertyLabel,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse validation rules from property definition
   */
  private parseValidationRules(property: PropertyDefinition): AnyValidationRule[] {
    const validationRules = property.validationRules;
    if (!this.isPropertyValidationRules(validationRules)) {
      return [];
    }
    return validationRules.rules;
  }

  /**
   * Type guard to verify validation rules shape
   */
  private isPropertyValidationRules(value: unknown): value is PropertyValidationRules {
    if (!value || typeof value !== 'object') {
      return false;
    }

    return Array.isArray((value as PropertyValidationRules).rules);
  }

  /**
   * Check if a value is empty
   */
  private isEmpty(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  private validateDataType(
    value: unknown,
    fieldLabel: string,
    property: PropertyDefinition
  ): ValidationRuleResult | null {
    if (this.isEmpty(value)) {
      return null;
    }

    const rawType = property.propertyType?.code
      ?? (property.config as Record<string, unknown> | undefined)?.dataType;

    if (typeof rawType !== 'string') {
      return null;
    }

    const normalized = this.normalizeTypeCode(rawType);
    if (!normalized) {
      return null;
    }

    switch (normalized) {
      case 'text':
      case 'rich-text':
        return typeof value === 'string'
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be text` };

      case 'number':
      case 'currency':
      case 'duration':
        if (typeof value === 'number' && !Number.isNaN(value)) {
          return null;
        }
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
          return null;
        }
        return { rule: 'type', passed: false, message: `${fieldLabel} must be a number` };

      case 'boolean':
        return typeof value === 'boolean'
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be true or false` };

      case 'date':
      case 'datetime':
        return this.isValidDate(value)
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be a valid date` };

      case 'choice':
        return this.validateChoiceValue(value, fieldLabel, property, false);

      case 'multi-choice':
        return this.validateChoiceValue(value, fieldLabel, property, true);

      case 'reference':
      case 'user':
        return this.isValidUuid(value)
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be a valid reference` };

      case 'multi-reference':
      case 'multi-user':
        return Array.isArray(value) && value.every((entry) => this.isValidUuid(entry))
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be a list of references` };

      case 'json':
      case 'hierarchical':
        return typeof value === 'object' && value !== null
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be structured data` };

      case 'attachment':
      case 'geolocation':
        return typeof value === 'object' && value !== null
          ? null
          : { rule: 'type', passed: false, message: `${fieldLabel} must be a structured value` };

      default:
        return null;
    }
  }

  private normalizeTypeCode(rawType: string): CanonicalPropertyType | null {
    if (isCanonicalPropertyType(rawType as CanonicalPropertyType)) {
      return rawType as CanonicalPropertyType;
    }

    if (isLegacyPropertyType(rawType as PropertyType)) {
      return normalizePropertyType(rawType as PropertyType);
    }

    return null;
  }

  private isValidDate(value: unknown): boolean {
    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    }

    return false;
  }

  private isValidUuid(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private validateChoiceValue(
    value: unknown,
    fieldLabel: string,
    property: PropertyDefinition,
    multi: boolean
  ): ValidationRuleResult | null {
    const config = property.config as Record<string, unknown> | undefined;
    const choices = Array.isArray(config?.choices)
      ? (config?.choices as Array<{ value?: unknown }>)
      : null;
    const validValues = choices
      ? new Set(choices.map((choice) => String(choice.value)))
      : null;

    if (multi) {
      if (!Array.isArray(value)) {
        return { rule: 'type', passed: false, message: `${fieldLabel} must be a list of choices` };
      }

      if (validValues) {
        const invalid = value.find((entry) => !validValues.has(String(entry)));
        if (invalid !== undefined) {
          return { rule: 'type', passed: false, message: `${fieldLabel} has an invalid choice` };
        }
      }

      return null;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return { rule: 'type', passed: false, message: `${fieldLabel} must be a valid choice` };
    }

    if (validValues && !validValues.has(String(value))) {
      return { rule: 'type', passed: false, message: `${fieldLabel} has an invalid choice` };
    }

    return null;
  }

  /**
   * Validate a single rule
   */
  private async validateRule(
    value: unknown,
    rule: AnyValidationRule,
    fieldLabel: string,
    context: ValidationContext
  ): Promise<ValidationRuleResult> {
    switch (rule.type) {
      case 'required':
        return this.validateRequired(value, fieldLabel, rule.message);

      case 'regex':
        return this.validateRegex(value, rule as RegexRule, fieldLabel);

      case 'min':
        return this.validateMin(value, rule as MinRule, fieldLabel);

      case 'max':
        return this.validateMax(value, rule as MaxRule, fieldLabel);

      case 'min_length':
        return this.validateMinLength(value, rule as MinLengthRule, fieldLabel);

      case 'max_length':
        return this.validateMaxLength(value, rule as MaxLengthRule, fieldLabel);

      case 'range':
        return this.validateRange(value, rule as RangeRule, fieldLabel);

      case 'email':
        return this.validateEmail(value, fieldLabel, rule.message);

      case 'url':
        return this.validateUrl(value, rule as UrlRule, fieldLabel);

      case 'phone':
        return this.validatePhone(value, rule as PhoneRule, fieldLabel);

      case 'custom':
        return this.validateCustom(value, rule as CustomRule, fieldLabel, context);

      default:
        this.logger.warn(`Unknown validation rule type: ${(rule as AnyValidationRule).type}`);
        return { rule: (rule as AnyValidationRule).type, passed: true };
    }
  }

  /**
   * Required validation
   */
  private validateRequired(value: unknown, fieldLabel: string, customMessage?: string): ValidationRuleResult {
    const passed = !this.isEmpty(value);
    return {
      rule: 'required',
      passed,
      message: passed ? undefined : customMessage || `${fieldLabel} is required`,
    };
  }

  /**
   * Regex pattern validation
   */
  private validateRegex(value: unknown, rule: RegexRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'regex', passed: true };
    }

    try {
      const regex = new RegExp(rule.pattern, rule.flags);
      const passed = regex.test(String(value));
      return {
        rule: 'regex',
        passed,
        message: passed ? undefined : rule.message || `${fieldLabel} does not match the required format`,
      };
    } catch (error) {
      this.logger.error(`Invalid regex pattern: ${rule.pattern}`, error);
      return {
        rule: 'regex',
        passed: false,
        message: 'Invalid validation pattern configured',
      };
    }
  }

  /**
   * Minimum value validation
   */
  private validateMin(value: unknown, rule: MinRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'min', passed: true };
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        rule: 'min',
        passed: false,
        message: `${fieldLabel} must be a number`,
      };
    }

    const inclusive = rule.inclusive !== false;
    const passed = inclusive ? numValue >= rule.value : numValue > rule.value;

    return {
      rule: 'min',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be ${inclusive ? 'at least' : 'greater than'} ${rule.value}`,
    };
  }

  /**
   * Maximum value validation
   */
  private validateMax(value: unknown, rule: MaxRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'max', passed: true };
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        rule: 'max',
        passed: false,
        message: `${fieldLabel} must be a number`,
      };
    }

    const inclusive = rule.inclusive !== false;
    const passed = inclusive ? numValue <= rule.value : numValue < rule.value;

    return {
      rule: 'max',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be ${inclusive ? 'at most' : 'less than'} ${rule.value}`,
    };
  }

  /**
   * Minimum length validation
   */
  private validateMinLength(value: unknown, rule: MinLengthRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'min_length', passed: true };
    }

    const strValue = String(value);
    const passed = strValue.length >= rule.length;

    return {
      rule: 'min_length',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be at least ${rule.length} characters`,
    };
  }

  /**
   * Maximum length validation
   */
  private validateMaxLength(value: unknown, rule: MaxLengthRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'max_length', passed: true };
    }

    const strValue = String(value);
    const passed = strValue.length <= rule.length;

    return {
      rule: 'max_length',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be at most ${rule.length} characters`,
    };
  }

  /**
   * Range validation (for numbers or dates)
   */
  private validateRange(value: unknown, rule: RangeRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'range', passed: true };
    }

    // Determine if we're dealing with dates or numbers
    const isDateRange =
      typeof rule.min === 'string' || typeof rule.max === 'string';

    if (isDateRange) {
      return this.validateDateRange(value, rule, fieldLabel);
    }

    return this.validateNumericRange(value, rule, fieldLabel);
  }

  /**
   * Numeric range validation
   */
  private validateNumericRange(value: unknown, rule: RangeRule, fieldLabel: string): ValidationRuleResult {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        rule: 'range',
        passed: false,
        message: `${fieldLabel} must be a number`,
      };
    }

    const minInclusive = rule.minInclusive !== false;
    const maxInclusive = rule.maxInclusive !== false;

    let passed = true;

    if (rule.min !== undefined) {
      const minVal = Number(rule.min);
      passed = passed && (minInclusive ? numValue >= minVal : numValue > minVal);
    }

    if (rule.max !== undefined) {
      const maxVal = Number(rule.max);
      passed = passed && (maxInclusive ? numValue <= maxVal : numValue < maxVal);
    }

    return {
      rule: 'range',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be between ${rule.min ?? '(unbounded)'} and ${rule.max ?? '(unbounded)'}`,
    };
  }

  /**
   * Date range validation
   */
  private validateDateRange(value: unknown, rule: RangeRule, fieldLabel: string): ValidationRuleResult {
    const dateValue = new Date(value as string | number | Date);
    if (isNaN(dateValue.getTime())) {
      return {
        rule: 'range',
        passed: false,
        message: `${fieldLabel} must be a valid date`,
      };
    }

    const minInclusive = rule.minInclusive !== false;
    const maxInclusive = rule.maxInclusive !== false;

    let passed = true;

    if (rule.min !== undefined) {
      const minDate = new Date(rule.min);
      passed = passed && (minInclusive ? dateValue >= minDate : dateValue > minDate);
    }

    if (rule.max !== undefined) {
      const maxDate = new Date(rule.max);
      passed = passed && (maxInclusive ? dateValue <= maxDate : dateValue < maxDate);
    }

    return {
      rule: 'range',
      passed,
      message: passed
        ? undefined
        : rule.message || `${fieldLabel} must be between ${rule.min ?? '(any)'} and ${rule.max ?? '(any)'}`,
    };
  }

  /**
   * Email format validation
   */
  private validateEmail(value: unknown, fieldLabel: string, customMessage?: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'email', passed: true };
    }

    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const passed = emailRegex.test(String(value));

    return {
      rule: 'email',
      passed,
      message: passed ? undefined : customMessage || `${fieldLabel} must be a valid email address`,
    };
  }

  /**
   * URL format validation
   */
  private validateUrl(value: unknown, rule: UrlRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'url', passed: true };
    }

    try {
      const url = new URL(String(value));
      const allowedProtocols = rule.protocols || ['http', 'https'];
      const protocol = url.protocol.replace(':', '');
      const passed = allowedProtocols.includes(protocol);

      return {
        rule: 'url',
        passed,
        message: passed
          ? undefined
          : rule.message || `${fieldLabel} must be a valid URL with protocol: ${allowedProtocols.join(', ')}`,
      };
    } catch {
      return {
        rule: 'url',
        passed: false,
        message: rule.message || `${fieldLabel} must be a valid URL`,
      };
    }
  }

  /**
   * Phone number format validation
   */
  private validatePhone(value: unknown, rule: PhoneRule, fieldLabel: string): ValidationRuleResult {
    if (this.isEmpty(value)) {
      return { rule: 'phone', passed: true };
    }

    const format = rule.format || 'any';
    let pattern: RegExp;

    switch (format) {
      case 'international':
        // E.164 format: +[country code][number]
        pattern = /^\+[1-9]\d{6,14}$/;
        break;
      case 'us':
        // US format: (XXX) XXX-XXXX or XXX-XXX-XXXX or XXXXXXXXXX
        pattern = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
        break;
      case 'any':
      default:
        // Any phone-like format (digits, spaces, dashes, parentheses, plus)
        pattern = /^[\d\s\-.()+]{7,20}$/;
        break;
    }

    const passed = pattern.test(String(value).replace(/\s/g, ''));

    return {
      rule: 'phone',
      passed,
      message: passed ? undefined : rule.message || `${fieldLabel} must be a valid phone number`,
    };
  }

  /**
   * Custom script-based validation
   *
   * SECURITY: Uses expr-eval for safe expression evaluation instead of
   * the dangerous Function constructor. Only whitelisted functions are available.
   *
   * Example scripts:
   *   - "value > 0 and value < 100"
   *   - "length(value) >= 5"
   *   - "isNull(record.endDate) or record.endDate > record.startDate"
   *   - "contains(value, '@')"
   */
  private async validateCustom(
    value: unknown,
    rule: CustomRule,
    fieldLabel: string,
    context: ValidationContext
  ): Promise<ValidationRuleResult> {
    if (this.isEmpty(value) && rule.script.includes('value')) {
      return { rule: 'custom', passed: true };
    }

    try {
      // SECURITY: Validate script content before execution
      this.validateScriptSecurity(rule.script);

      // Parse the expression using safe parser
      const expression = this.safeParser.parse(rule.script);

      // Build safe variable context
      const variables: Record<string, unknown> = {
        value,
        record: context.record || {},
        isCreate: context.isCreate,
        existingRecord: context.existingRecord || {},
        null: null,
        true: true,
        false: false,
      };

      // Flatten record fields for easier access in expressions
      if (context.record) {
        for (const [key, val] of Object.entries(context.record)) {
          // Prefix with 'field_' to avoid conflicts with reserved words
          variables[key] = val;
        }
      }

      // Evaluate the expression (cast for expr-eval compatibility)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = expression.evaluate(variables as any);
      const passed = Boolean(result);

      return {
        rule: 'custom',
        passed,
        message: passed ? undefined : rule.message || `${fieldLabel} failed custom validation`,
      };
    } catch (error) {
      this.logger.error(`Custom validation script error: ${(error as Error).message}`);
      return {
        rule: 'custom',
        passed: false,
        message: `Validation error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get validation errors as a simple string array (for API responses)
   */
  getErrorMessages(result: RecordValidationResult): string[] {
    const messages: string[] = [];

    for (const prop of result.properties) {
      for (const error of prop.errors) {
        if (error.message) {
          messages.push(error.message);
        }
      }
    }

    return messages;
  }
}
