/**
 * Plan §7.3 — runtime Condition evaluator. Mirrors svc-automation
 * `ConditionEvaluatorService` semantics so the SAME function tree is
 * used for server-side evaluation (form load resolution) and
 * client-side evaluation (field change). The plan calls out "no
 * parallel implementation" for this exact reason.
 *
 * The shape:
 *   - ConditionGroup: { and: Condition[] } or { or: Condition[] }
 *   - SingleCondition: { property: string, operator, value? }
 *   - Empty / unknown shapes evaluate to `true` (matches server's
 *     "Empty condition treated as true" branch).
 */

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

export interface SingleCondition {
  property: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  and?: Condition[];
  or?: Condition[];
}

export type Condition = ConditionGroup | SingleCondition;

export type DisplayActionKind =
  | 'show'
  | 'hide'
  | 'mandatory'
  | 'optional'
  | 'readonly'
  | 'editable'
  | 'setValue';

export interface DisplayAction {
  propertyCode: string;
  action: DisplayActionKind;
  value?: unknown;
}

export const evaluateCondition = (
  condition: Condition | Record<string, unknown> | null | undefined,
  record: Record<string, unknown>,
): boolean => {
  if (!condition || typeof condition !== 'object') return true;
  const cond = condition as Condition;

  if ('and' in cond && Array.isArray(cond.and)) {
    if (cond.and.length === 0) return true;
    return cond.and.every((c) => evaluateCondition(c, record));
  }
  if ('or' in cond && Array.isArray(cond.or)) {
    if (cond.or.length === 0) return true;
    return cond.or.some((c) => evaluateCondition(c, record));
  }

  if ('property' in cond && 'operator' in cond) {
    return evaluateSingle(cond as SingleCondition, record);
  }

  return true;
};

const resolveProperty = (path: string, record: Record<string, unknown>): unknown => {
  if (!path) return undefined;
  const segments = path.split('.');
  let cursor: unknown = record;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
};

const toComparable = (value: unknown): number | string | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  const s = String(value);
  const asNum = Number(s);
  if (!isNaN(asNum) && s.trim() !== '') return asNum;
  return s;
};

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const evaluateSingle = (cond: SingleCondition, record: Record<string, unknown>): boolean => {
  const actual = resolveProperty(cond.property, record);
  return applyOperator(cond.operator, actual, cond.value);
};

const applyOperator = (
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown,
): boolean => {
  switch (operator) {
    case 'is_null':
      return isEmpty(actual);
    case 'is_not_null':
      return !isEmpty(actual);
    case 'equals':
      return looseEqual(actual, expected);
    case 'not_equals':
      return !looseEqual(actual, expected);
    case 'contains':
      return stringContains(actual, expected);
    case 'not_contains':
      return !stringContains(actual, expected);
    case 'starts_with':
      return stringTest(actual, expected, (s, e) => s.startsWith(e));
    case 'ends_with':
      return stringTest(actual, expected, (s, e) => s.endsWith(e));
    case 'greater_than':
      return compareValues(actual, expected, (a, e) => a > e);
    case 'greater_than_or_equals':
      return compareValues(actual, expected, (a, e) => a >= e);
    case 'less_than':
      return compareValues(actual, expected, (a, e) => a < e);
    case 'less_than_or_equals':
      return compareValues(actual, expected, (a, e) => a <= e);
    case 'in':
      return Array.isArray(expected) && expected.some((e) => looseEqual(actual, e));
    case 'not_in':
      return Array.isArray(expected) && !expected.some((e) => looseEqual(actual, e));
    default:
      return false;
  }
};

const looseEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === typeof b) return a === b;
  return String(a) === String(b);
};

const stringContains = (actual: unknown, expected: unknown): boolean => {
  if (Array.isArray(actual)) {
    return actual.some((item) => looseEqual(item, expected));
  }
  return stringTest(actual, expected, (s, e) => s.includes(e));
};

const stringTest = (
  actual: unknown,
  expected: unknown,
  predicate: (s: string, e: string) => boolean,
): boolean => {
  if (actual == null || expected == null) return false;
  return predicate(String(actual), String(expected));
};

const compareValues = (
  actual: unknown,
  expected: unknown,
  predicate: (a: number | string, e: number | string) => boolean,
): boolean => {
  const aComp = toComparable(actual);
  const eComp = toComparable(expected);
  if (aComp == null || eComp == null) return false;
  if (typeof aComp === typeof eComp) {
    return predicate(aComp as number | string, eComp as number | string);
  }
  return predicate(String(aComp), String(eComp));
};

export interface ResolvedDisplay {
  hidden: Set<string>;
  mandatory: Set<string>;
  readonly: Set<string>;
  values: Map<string, unknown>;
}

/**
 * Compose all matching display-rule actions for a record. Rules are
 * sorted by priority ASC (lower runs first) so a higher-priority
 * rule's actions overwrite earlier ones for the same propertyCode.
 * Inactive rules are skipped.
 */
export const composeDisplay = (
  rules: ReadonlyArray<{
    condition: Condition | Record<string, unknown>;
    actions: DisplayAction[];
    priority: number;
    isActive: boolean;
  }>,
  record: Record<string, unknown>,
): ResolvedDisplay => {
  const result: ResolvedDisplay = {
    hidden: new Set(),
    mandatory: new Set(),
    readonly: new Set(),
    values: new Map(),
  };

  const ordered = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of ordered) {
    if (!evaluateCondition(rule.condition, record)) continue;
    for (const action of rule.actions) {
      switch (action.action) {
        case 'hide':
          result.hidden.add(action.propertyCode);
          break;
        case 'show':
          result.hidden.delete(action.propertyCode);
          break;
        case 'mandatory':
          result.mandatory.add(action.propertyCode);
          break;
        case 'optional':
          result.mandatory.delete(action.propertyCode);
          break;
        case 'readonly':
          result.readonly.add(action.propertyCode);
          break;
        case 'editable':
          result.readonly.delete(action.propertyCode);
          break;
        case 'setValue':
          result.values.set(action.propertyCode, action.value);
          break;
        default:
          break;
      }
    }
  }
  return result;
};
