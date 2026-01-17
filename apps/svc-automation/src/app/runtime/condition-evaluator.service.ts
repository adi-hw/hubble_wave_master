import { Injectable } from '@nestjs/common';
import {
  Condition,
  SingleCondition,
  ConditionOperator,
  ExecutionContext,
} from './automation-runtime.types';

export interface EvaluationResult {
  result: boolean;
  summary: string;
  trace: ConditionTrace;
  durationMs: number;
}

export interface ConditionTrace {
  type: 'and' | 'or' | 'single';
  result: boolean;
  property?: string;
  operator?: ConditionOperator;
  expectedValue?: unknown;
  actualValue?: unknown;
  explanation?: string;
  children?: ConditionTrace[];
  shortCircuited?: boolean;
}

@Injectable()
export class ConditionEvaluatorService {
  evaluate(condition: Condition, context: ExecutionContext): EvaluationResult {
    const startTime = Date.now();
    const trace = this.evaluateNode(condition, context);
    const durationMs = Date.now() - startTime;

    return {
      result: trace.result,
      summary: this.buildSummary(trace),
      trace,
      durationMs,
    };
  }

  evaluateQuick(condition: Condition, context: ExecutionContext): boolean {
    return this.evaluateNodeQuick(condition, context);
  }

  private evaluateNode(condition: Condition, context: ExecutionContext): ConditionTrace {
    if ('and' in condition && Array.isArray(condition.and)) {
      return this.evaluateAndGroup(condition.and, context);
    }

    if ('or' in condition && Array.isArray(condition.or)) {
      return this.evaluateOrGroup(condition.or, context);
    }

    if ('property' in condition && 'operator' in condition) {
      return this.evaluateSingle(condition as SingleCondition, context);
    }

    return {
      type: 'single',
      result: true,
      explanation: 'Empty condition treated as true',
    };
  }

  private evaluateAndGroup(conditions: Condition[], context: ExecutionContext): ConditionTrace {
    const children: ConditionTrace[] = [];
    let shortCircuited = false;

    for (const subCondition of conditions) {
      const childTrace = this.evaluateNode(subCondition, context);
      children.push(childTrace);

      if (!childTrace.result) {
        shortCircuited = true;
        break;
      }
    }

    const result = children.every((c) => c.result);

    return {
      type: 'and',
      result,
      children,
      shortCircuited,
    };
  }

  private evaluateOrGroup(conditions: Condition[], context: ExecutionContext): ConditionTrace {
    const children: ConditionTrace[] = [];
    let shortCircuited = false;

    for (const subCondition of conditions) {
      const childTrace = this.evaluateNode(subCondition, context);
      children.push(childTrace);

      if (childTrace.result) {
        shortCircuited = true;
        break;
      }
    }

    const result = children.some((c) => c.result);

    return {
      type: 'or',
      result,
      children,
      shortCircuited,
    };
  }

  private evaluateSingle(condition: SingleCondition, context: ExecutionContext): ConditionTrace {
    const { property, operator, value } = condition;

    const actualValue = this.getPropertyValue(property, context);
    const expectedValue = this.resolveValue(value, context);
    const result = this.evaluateOperator(operator, actualValue, expectedValue, context);

    const explanation = this.buildExplanation(
      property,
      operator,
      expectedValue,
      actualValue,
      result,
    );

    return {
      type: 'single',
      result,
      property,
      operator,
      expectedValue,
      actualValue,
      explanation,
    };
  }

  private buildExplanation(
    property: string,
    operator: ConditionOperator,
    expected: unknown,
    actual: unknown,
    result: boolean,
  ): string {
    const actualStr = this.formatValue(actual);
    const expectedStr = this.formatValue(expected);
    const opStr = this.formatOperator(operator);
    if (result) {
      return `"${property}" ${opStr} ${expectedStr} (actual: ${actualStr})`;
    }
    return `"${property}" ${opStr} ${expectedStr} failed (actual: ${actualStr})`;
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatValue(v)).join(', ')}]`;
    }
    return String(value);
  }

  private formatOperator(op: ConditionOperator): string {
    const opMap: Record<ConditionOperator, string> = {
      equals: 'equals',
      not_equals: 'does not equal',
      contains: 'contains',
      not_contains: 'does not contain',
      starts_with: 'starts with',
      ends_with: 'ends with',
      greater_than: '>',
      greater_than_or_equals: '>=',
      greater_equal: '>=',
      less_than: '<',
      less_than_or_equals: '<=',
      less_equal: '<=',
      in: 'is in',
      not_in: 'is not in',
      is_null: 'is null',
      is_not_null: 'is not null',
      is_today: 'is today',
      is_past: 'is in the past',
      is_future: 'is in the future',
      between: 'is between',
      changed: 'changed',
      changed_to: 'changed to',
      changed_from: 'changed from',
    };
    return opMap[op] || op;
  }

  private buildSummary(trace: ConditionTrace): string {
    if (trace.type === 'single') {
      return trace.explanation || (trace.result ? 'Condition met' : 'Condition not met');
    }

    const childCount = trace.children?.length || 0;
    const passedCount = trace.children?.filter((c) => c.result).length || 0;

    if (trace.result) {
      if (trace.type === 'and') {
        return `All ${childCount} conditions passed`;
      }
      return `${passedCount} of ${childCount} conditions passed`;
    }

    if (trace.type === 'and') {
      return `${childCount - passedCount} of ${childCount} conditions failed`;
    }
    return `None of ${childCount} conditions passed`;
  }

  private evaluateNodeQuick(condition: Condition, context: ExecutionContext): boolean {
    if ('and' in condition && Array.isArray(condition.and)) {
      return condition.and.every((c) => this.evaluateNodeQuick(c, context));
    }
    if ('or' in condition && Array.isArray(condition.or)) {
      return condition.or.some((c) => this.evaluateNodeQuick(c, context));
    }
    if ('property' in condition && 'operator' in condition) {
      const single = condition as SingleCondition;
      const actual = this.getPropertyValue(single.property, context);
      const expected = this.resolveValue(single.value, context);
      return this.evaluateOperator(single.operator, actual, expected, context);
    }
    return true;
  }

  private getPropertyValue(property: string, context: ExecutionContext): unknown {
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

    if (value.startsWith('@currentUser.')) {
      const prop = value.substring(13);
      return (context.user as unknown as Record<string, unknown>)[prop];
    }

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
      case 'greater_equal':
        return this.compare(actual, expected) >= 0;
      case 'less_than':
        return this.compare(actual, expected) < 0;
      case 'less_than_or_equals':
      case 'less_equal':
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

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (a instanceof Date && typeof b === 'string') {
      return a.getTime() === new Date(b).getTime();
    }
    if (typeof a === 'string' && b instanceof Date) {
      return new Date(a).getTime() === b.getTime();
    }

    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() === b.toLowerCase();
    }

    return JSON.stringify(a) === JSON.stringify(b);
  }

  private compare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    if (a instanceof Date || b instanceof Date) {
      const dateA = a instanceof Date ? a : new Date(String(a));
      const dateB = b instanceof Date ? b : new Date(String(b));
      return dateA.getTime() - dateB.getTime();
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

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
