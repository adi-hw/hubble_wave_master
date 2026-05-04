import { ConditionEvaluatorService } from './condition-evaluator.service';
import type { Condition, ExecutionContext } from '../../types/automation.types';

const buildContext = (record: Record<string, unknown>): ExecutionContext => ({
  user: { id: 'user-1' },
  record,
  previousRecord: undefined,
  changes: [],
  automation: {
    id: 'auto-1',
    name: 'Test rule',
    triggerTiming: 'before',
    abortOnError: false,
  },
  depth: 1,
  maxDepth: 5,
  executionChain: [],
  recordsModified: new Map(),
  outputs: {},
  asyncQueue: [],
  errors: [],
  warnings: [],
});

describe('ConditionEvaluatorService — Phase 4 §9.4 fail-closed authz', () => {
  let svc: ConditionEvaluatorService;

  beforeEach(() => {
    svc = new ConditionEvaluatorService();
  });

  it('matches a single equality condition against the record', () => {
    const condition: Condition = {
      property: 'status',
      operator: 'equals',
      value: 'Active',
    };
    const result = svc.evaluate(condition, buildContext({ status: 'Active' }));
    expect(result.result).toBe(true);
  });

  it('returns false when the property is absent — proxy for an authz-redacted field', () => {
    // Wave 2 condition-evaluator authz: properties the actor cannot
    // read are stripped from `context.record` before rule execution.
    // A condition referencing a redacted property must NOT match —
    // otherwise an actor who cannot read salary could trigger an
    // action gated on `salary > 100000`.
    const condition: Condition = {
      property: 'salary',
      operator: 'greater_than',
      value: 100000,
    };
    const result = svc.evaluate(condition, buildContext({ id: 'rec-1' }));
    expect(result.result).toBe(false);
  });

  it('AND group short-circuits and reports false when any child fails', () => {
    const condition: Condition = {
      and: [
        { property: 'status', operator: 'equals', value: 'Active' },
        { property: 'priority', operator: 'equals', value: 'P1' },
      ],
    };
    const result = svc.evaluate(
      condition,
      buildContext({ status: 'Active', priority: 'P3' }),
    );
    expect(result.result).toBe(false);
  });

  it('OR group passes when any child matches even if the other references a missing field', () => {
    const condition: Condition = {
      or: [
        { property: 'priority', operator: 'equals', value: 'P1' },
        { property: 'salary', operator: 'greater_than', value: 100000 },
      ],
    };
    const result = svc.evaluate(condition, buildContext({ priority: 'P1' }));
    expect(result.result).toBe(true);
  });

  it('empty / invalid condition is treated as always true (default-allow for unconditional rules)', () => {
    const condition = {} as Condition;
    const result = svc.evaluate(condition, buildContext({}));
    expect(result.result).toBe(true);
  });
});
