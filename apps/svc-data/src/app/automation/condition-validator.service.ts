import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Condition,
  ConditionOperator,
} from '../../types/automation.types';

// ============================================================================
// CONDITION VALIDATOR
// ============================================================================
// HubbleWave validates conditions strictly - no silent transformations.
// If the format is wrong, you get a clear error message explaining what's wrong.
// This ensures the API contract is explicit and predictable.
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  received?: unknown;
  expected?: string;
}

const VALID_OPERATORS: ConditionOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_than_or_equals',
  'greater_equal',
  'less_than',
  'less_than_or_equals',
  'less_equal',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'is_today',
  'is_past',
  'is_future',
  'between',
  'changed',
  'changed_to',
  'changed_from',
];

@Injectable()
export class ConditionValidatorService {
  /**
   * Validate a condition and return detailed errors if invalid
   */
  validate(condition: unknown, path = 'condition'): ValidationResult {
    const errors: ValidationError[] = [];

    if (condition === null || condition === undefined) {
      // Empty condition is valid (means "always")
      return { valid: true, errors: [] };
    }

    if (typeof condition !== 'object' || Array.isArray(condition)) {
      errors.push({
        path,
        message: 'Condition must be an object',
        received: typeof condition,
        expected: 'object with { and: [...] }, { or: [...] }, or { property, operator, value }',
      });
      return { valid: false, errors };
    }

    const cond = condition as Record<string, unknown>;

    // Check if it's a group (and/or) or single condition
    const hasAnd = 'and' in cond;
    const hasOr = 'or' in cond;
    const hasProperty = 'property' in cond;
    const hasOperator = 'operator' in cond;

    // Validate it's one of the valid forms
    if (hasAnd && hasOr) {
      errors.push({
        path,
        message: 'Condition cannot have both "and" and "or" at the same level',
        expected: 'Either { and: [...] } or { or: [...] }, not both',
      });
    }

    if ((hasAnd || hasOr) && (hasProperty || hasOperator)) {
      errors.push({
        path,
        message: 'Condition cannot mix group operators (and/or) with property operators',
        expected: 'Group: { and: [...] } or { or: [...] }, Single: { property, operator, value }',
      });
    }

    // Validate group condition
    if (hasAnd) {
      this.validateGroup(cond.and, `${path}.and`, errors);
    } else if (hasOr) {
      this.validateGroup(cond.or, `${path}.or`, errors);
    } else if (hasProperty || hasOperator) {
      // Single condition
      this.validateSingle(cond, path, errors);
    } else {
      errors.push({
        path,
        message: 'Invalid condition structure',
        received: Object.keys(cond),
        expected: '{ and: [...] }, { or: [...] }, or { property, operator, value }',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(condition: unknown, context = 'condition'): void {
    const result = this.validate(condition, context);
    if (!result.valid) {
      const errorMessages = result.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join('; ');
      throw new BadRequestException(
        `Invalid ${context}: ${errorMessages}. ` +
          `See API documentation for the correct condition format.`,
      );
    }
  }

  /**
   * Check if a condition is in the canonical format (for quick checks)
   */
  isValidFormat(condition: unknown): boolean {
    return this.validate(condition).valid;
  }

  private validateGroup(
    group: unknown,
    path: string,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(group)) {
      errors.push({
        path,
        message: 'Group must be an array of conditions',
        received: typeof group,
        expected: 'array',
      });
      return;
    }

    if (group.length === 0) {
      errors.push({
        path,
        message: 'Group must contain at least one condition',
        received: 'empty array',
        expected: 'at least one condition',
      });
      return;
    }

    group.forEach((item, index) => {
      const itemResult = this.validate(item, `${path}[${index}]`);
      errors.push(...itemResult.errors);
    });
  }

  private validateSingle(
    condition: Record<string, unknown>,
    path: string,
    errors: ValidationError[],
  ): void {
    // Property is required
    if (!('property' in condition)) {
      errors.push({
        path: `${path}.property`,
        message: 'Single condition must have a "property" field',
        expected: 'string property name',
      });
    } else if (typeof condition.property !== 'string') {
      errors.push({
        path: `${path}.property`,
        message: 'Property must be a string',
        received: typeof condition.property,
        expected: 'string',
      });
    } else if (condition.property.length === 0) {
      errors.push({
        path: `${path}.property`,
        message: 'Property cannot be empty',
        received: '""',
        expected: 'non-empty string',
      });
    }

    // Operator is required
    if (!('operator' in condition)) {
      errors.push({
        path: `${path}.operator`,
        message: 'Single condition must have an "operator" field',
        expected: `one of: ${VALID_OPERATORS.join(', ')}`,
      });
    } else if (typeof condition.operator !== 'string') {
      errors.push({
        path: `${path}.operator`,
        message: 'Operator must be a string',
        received: typeof condition.operator,
        expected: 'string',
      });
    } else if (!VALID_OPERATORS.includes(condition.operator as ConditionOperator)) {
      errors.push({
        path: `${path}.operator`,
        message: `Invalid operator: "${condition.operator}"`,
        received: condition.operator,
        expected: `one of: ${VALID_OPERATORS.join(', ')}`,
      });
    }

    // Value is required for most operators
    const noValueOperators: ConditionOperator[] = [
      'is_null',
      'is_not_null',
      'is_today',
      'is_past',
      'is_future',
    ];

    const op = condition.operator as ConditionOperator;
    if (!('value' in condition) && !noValueOperators.includes(op)) {
      errors.push({
        path: `${path}.value`,
        message: `Operator "${op}" requires a "value" field`,
        expected: 'value matching the operator requirements',
      });
    }

    // Validate value type for specific operators
    if ('value' in condition) {
      this.validateValueForOperator(condition.value, op, `${path}.value`, errors);
    }
  }

  private validateValueForOperator(
    value: unknown,
    operator: ConditionOperator,
    path: string,
    errors: ValidationError[],
  ): void {
    switch (operator) {
      case 'in':
      case 'not_in':
        if (!Array.isArray(value)) {
          errors.push({
            path,
            message: `Operator "${operator}" requires an array value`,
            received: typeof value,
            expected: 'array',
          });
        }
        break;

      case 'between':
        if (!Array.isArray(value) || value.length !== 2) {
          errors.push({
            path,
            message: 'Operator "between" requires an array of exactly 2 values [min, max]',
            received: Array.isArray(value) ? `array of ${value.length}` : typeof value,
            expected: '[min, max]',
          });
        }
        break;

      case 'is_null':
      case 'is_not_null':
      case 'is_today':
      case 'is_past':
      case 'is_future':
        // These operators don't need a value, but if provided, it's ignored
        break;
    }
  }

  /**
   * Generate example conditions for documentation
   */
  getExamples(): Record<string, Condition> {
    return {
      simple: {
        property: 'status',
        operator: 'equals',
        value: 'active',
      },
      andGroup: {
        and: [
          { property: 'status', operator: 'equals', value: 'active' },
          { property: 'priority', operator: 'greater_than', value: 3 },
        ],
      },
      orGroup: {
        or: [
          { property: 'urgent', operator: 'equals', value: true },
          { property: 'vip', operator: 'equals', value: true },
        ],
      },
      nested: {
        or: [
          { property: 'urgent', operator: 'equals', value: true },
          {
            and: [
              { property: 'priority', operator: 'equals', value: 1 },
              { property: 'sla_breach', operator: 'equals', value: true },
            ],
          },
        ],
      },
      withSpecialValues: {
        and: [
          { property: 'assigned_to', operator: 'equals', value: '@currentUser.id' },
          { property: 'due_date', operator: 'less_than', value: '@now.addDays(7)' },
        ],
      },
    };
  }
}
