import { Injectable } from '@nestjs/common';
import {
  Condition,
  ConditionGroup,
  SingleCondition,
  ConditionOperator,
  ExecutionContext,
} from '../../types/automation.types';

interface EvaluationResult {
  result: boolean;
  trace: Record<string, unknown>;
}

@Injectable()
export class ConditionEvaluatorService {
  /**
   * Evaluate a condition against the execution context
   */
  evaluate(condition: Condition, context: ExecutionContext): EvaluationResult {
    return this.evaluateNode(condition, context);
  }

  private evaluateNode(
    condition: Condition | ConditionGroup,
    context: ExecutionContext,
  ): EvaluationResult {
    // Check for AND group
    if ('and' in condition && Array.isArray(condition.and)) {
      const results: EvaluationResult[] = [];
      for (const subCondition of condition.and) {
        const result = this.evaluateNode(subCondition, context);
        results.push(result);
        if (!result.result) {
          return {
            result: false,
            trace: {
              type: 'AND',
              conditions: results.map((r) => r.trace),
              shortCircuited: true,
            },
          };
        }
      }
      return {
        result: true,
        trace: {
          type: 'AND',
          conditions: results.map((r) => r.trace),
        },
      };
    }

    // Check for OR group
    if ('or' in condition && Array.isArray(condition.or)) {
      const results: EvaluationResult[] = [];
      for (const subCondition of condition.or) {
        const result = this.evaluateNode(subCondition, context);
        results.push(result);
        if (result.result) {
          return {
            result: true,
            trace: {
              type: 'OR',
              conditions: results.map((r) => r.trace),
              shortCircuited: true,
            },
          };
        }
      }
      return {
        result: false,
        trace: {
          type: 'OR',
          conditions: results.map((r) => r.trace),
        },
      };
    }

    // Single condition
    const singleCondition = condition as SingleCondition;
    return this.evaluateSingle(singleCondition, context);
  }

  private evaluateSingle(
    condition: SingleCondition,
    context: ExecutionContext,
  ): EvaluationResult {
    const { property, operator, value } = condition;

    // Get actual value from record
    const actualValue = this.getPropertyValue(property, context);
    
    // Resolve expected value (handle special values)
    const expectedValue = this.resolveValue(value, context);

    // Evaluate operator
    const result = this.evaluateOperator(operator, actualValue, expectedValue, context);

    return {
      result,
      trace: {
        property,
        operator,
        expectedValue,
        actualValue,
        result,
      },
    };
  }

  private getPropertyValue(property: string, context: ExecutionContext): unknown {
    // Handle special property paths
    if (property.startsWith('_previous.')) {
      const prop = property.substring(10);
      return context.previousRecord?.[prop];
    }
    if (property === '_changes') {
      return context.changes;
    }
    return context.record[property];
  }

  private resolveValue(value: unknown, context: ExecutionContext): unknown {
    if (typeof value !== 'string') return value;

    // Record values
    if (value.startsWith('@record.')) {
      const path = value.substring(8);
      if (path.startsWith('_previous.')) {
        return context.previousRecord?.[path.substring(10)];
      }
      if (path === '_changes') {
        return context.changes;
      }
      return context.record[path];
    }

    // Current user values
    if (value.startsWith('@currentUser.')) {
      const prop = value.substring(13);
      return (context.user as any)[prop];
    }

    // Time values
    if (value === '@now') {
      return new Date();
    }
    if (value === '@today') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (value.startsWith('@now.addDays(')) {
      const match = value.match(/@now\.addDays\((-?\d+)\)/);
      if (match) {
        const days = parseInt(match[1], 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
      }
    }
    if (value.startsWith('@now.addHours(')) {
      const match = value.match(/@now\.addHours\((-?\d+)\)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const date = new Date();
        date.setHours(date.getHours() + hours);
        return date;
      }
    }

    // Tenant
    if (value === '@tenant.id') {
      return context.tenantId;
    }

    return value;
  }

  private evaluateOperator(
    operator: ConditionOperator,
    actual: unknown,
    expected: unknown,
    context: ExecutionContext,
  ): boolean {
    switch (operator) {
      case 'equals':
        return this.equals(actual, expected);
      case 'not_equals':
        return !this.equals(actual, expected);
      case 'greater_than':
        return this.compare(actual, expected) > 0;
      case 'greater_than_or_equals':
        return this.compare(actual, expected) >= 0;
      case 'less_than':
        return this.compare(actual, expected) < 0;
      case 'less_than_or_equals':
        return this.compare(actual, expected) <= 0;
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'not_contains':
        return !String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'starts_with':
        return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
      case 'ends_with':
        return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return !Array.isArray(expected) || !expected.includes(actual);
      case 'is_null':
        return actual == null;
      case 'is_not_null':
        return actual != null;
      case 'is_today':
        return this.isToday(actual);
      case 'is_past':
        return this.isPast(actual);
      case 'is_future':
        return this.isFuture(actual);
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          const [min, max] = expected;
          return this.compare(actual, min) >= 0 && this.compare(actual, max) <= 0;
        }
        return false;
      case 'changed':
        return context.changes.includes(String(expected));
      case 'changed_to':
        return (
          context.changes.includes(String(actual)) &&
          this.equals(context.record[String(actual)], expected)
        );
      case 'changed_from':
        return (
          context.changes.includes(String(actual)) &&
          this.equals(context.previousRecord?.[String(actual)], expected)
        );
      default:
        return false;
    }
  }

  private equals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    
    // Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (a instanceof Date && typeof b === 'string') {
      return a.getTime() === new Date(b).getTime();
    }
    if (typeof a === 'string' && b instanceof Date) {
      return new Date(a).getTime() === b.getTime();
    }
    
    // String comparison (case insensitive for strings)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() === b.toLowerCase();
    }
    
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private compare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // Date comparison
    if (a instanceof Date || b instanceof Date) {
      const dateA = a instanceof Date ? a : new Date(String(a));
      const dateB = b instanceof Date ? b : new Date(String(b));
      return dateA.getTime() - dateB.getTime();
    }

    // Number comparison
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    // String comparison
    return String(a).localeCompare(String(b));
  }

  private isToday(value: unknown): boolean {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(String(value));
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private isPast(value: unknown): boolean {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(String(value));
    return date.getTime() < Date.now();
  }

  private isFuture(value: unknown): boolean {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(String(value));
    return date.getTime() > Date.now();
  }
}
