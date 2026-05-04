/**
 * Pure-function evaluator for Decision Tables (Plan §8.2 / ADR-14).
 *
 * Lives in shared-types so it runs identically wherever a Decision
 * Table is consumed — svc-metadata's evaluate endpoint AND
 * svc-workflow's `MakeDecision` action handler call this same
 * function. Two callers, one definition: the canvas-time and
 * runtime answers can never drift because there's nothing to drift
 * between.
 */

export type DecisionRowOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'greater_than_or_equals'
  | 'less_than'
  | 'less_than_or_equals'
  | 'is_null'
  | 'is_not_null';

export interface DecisionRowConditionDto {
  inputId: string;
  operator: DecisionRowOperator;
  value?: unknown;
}

export interface DecisionInputDto {
  id: string;
  name: string;
  defaultValue?: unknown;
}

export interface DecisionRowDto {
  id: string;
  position: number;
  isActive: boolean;
  conditions: DecisionRowConditionDto[];
  answerLiteral?: unknown;
  answerRecordId?: string | null;
}

export interface DecisionTableDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  collectionId: string;
  hitPolicy: 'first_match' | 'all_matches';
  status: 'draft' | 'published' | 'deprecated';
  answerCollectionCode?: string | null;
  inputs: DecisionInputDto[];
  rows: DecisionRowDto[];
}

export interface DecisionEvaluationResult {
  matched: boolean;
  rowId?: string;
  rowPosition?: number;
  answer?: unknown;
  matches?: Array<{ rowId: string; rowPosition: number; answer: unknown }>;
}

export const evaluateDecisionTable = (
  table: DecisionTableDto,
  rawInputs: Record<string, unknown>,
): DecisionEvaluationResult => {
  const rows = (table.rows ?? [])
    .filter((r) => r.isActive)
    .sort((a, b) => a.position - b.position);

  const resolved: Record<string, unknown> = {};
  for (const inputDef of table.inputs) {
    if (inputDef.name in rawInputs) {
      resolved[inputDef.name] = rawInputs[inputDef.name];
    } else if (inputDef.defaultValue !== null && inputDef.defaultValue !== undefined) {
      resolved[inputDef.name] = inputDef.defaultValue;
    } else {
      resolved[inputDef.name] = null;
    }
  }

  const matches: Array<{ rowId: string; rowPosition: number; answer: unknown }> = [];
  for (const row of rows) {
    const matched = (row.conditions ?? []).every((cond) =>
      evaluateCondition(cond, resolved, table.inputs),
    );
    if (!matched) continue;
    const answer =
      row.answerLiteral !== null && row.answerLiteral !== undefined
        ? row.answerLiteral
        : row.answerRecordId
        ? { recordId: row.answerRecordId, collectionCode: table.answerCollectionCode }
        : null;
    matches.push({ rowId: row.id, rowPosition: row.position, answer });
    if (table.hitPolicy === 'first_match') break;
  }

  if (matches.length === 0) {
    return { matched: false };
  }
  if (table.hitPolicy === 'all_matches') {
    return {
      matched: true,
      matches,
      rowId: matches[0].rowId,
      rowPosition: matches[0].rowPosition,
      answer: matches.map((m) => m.answer),
    };
  }
  return {
    matched: true,
    rowId: matches[0].rowId,
    rowPosition: matches[0].rowPosition,
    answer: matches[0].answer,
  };
};

const evaluateCondition = (
  condition: DecisionRowConditionDto,
  inputs: Record<string, unknown>,
  inputDefs: ReadonlyArray<DecisionInputDto>,
): boolean => {
  const inputDef = inputDefs.find((i) => i.id === condition.inputId);
  if (!inputDef) return false;
  const actual = inputs[inputDef.name];
  return applyOperator(condition.operator, actual, condition.value);
};

const applyOperator = (
  operator: DecisionRowOperator,
  actual: unknown,
  expected: unknown,
): boolean => {
  const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
  switch (operator) {
    case 'is_null':
      return isEmpty(actual);
    case 'is_not_null':
      return !isEmpty(actual);
    case 'equals':
      return looseEqual(actual, expected);
    case 'not_equals':
      return !looseEqual(actual, expected);
    case 'in':
      return Array.isArray(expected) && expected.some((e) => looseEqual(actual, e));
    case 'not_in':
      return Array.isArray(expected) && !expected.some((e) => looseEqual(actual, e));
    case 'greater_than':
      return compareNumeric(actual, expected, (a, b) => a > b);
    case 'greater_than_or_equals':
      return compareNumeric(actual, expected, (a, b) => a >= b);
    case 'less_than':
      return compareNumeric(actual, expected, (a, b) => a < b);
    case 'less_than_or_equals':
      return compareNumeric(actual, expected, (a, b) => a <= b);
    default:
      return false;
  }
};

const looseEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  return String(a) === String(b);
};

const compareNumeric = (
  actual: unknown,
  expected: unknown,
  predicate: (a: number, b: number) => boolean,
): boolean => {
  const a = typeof actual === 'number' ? actual : Number(actual);
  const b = typeof expected === 'number' ? expected : Number(expected);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return predicate(a, b);
};
