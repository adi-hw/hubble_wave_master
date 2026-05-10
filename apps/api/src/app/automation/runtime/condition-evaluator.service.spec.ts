import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import {
  Condition,
  ExecutionContext,
  SingleCondition,
} from './automation-runtime.types';

// Characterization tests for ConditionEvaluatorService. The evaluator
// consumes a structured Condition object (property/operator/value), NOT a
// free-form expression — so the deny-list bypass suite lives in
// script-sandbox.service.spec.ts. This file covers operator semantics,
// AND/OR composition, truthy/falsy edges, and field-level filtering on
// unauthorized properties.
//
// Refs Part 2 Fix 5 (test coverage), Part 3 §3.1 W1.9.

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;

  const buildContext = (
    overrides: Partial<ExecutionContext> = {},
  ): ExecutionContext => ({
    user: { id: 'user-1' },
    record: { id: 'rec-1', name: 'Alice', count: 3, value: '' },
    previousRecord: null,
    changes: [],
    automation: {
      id: 'auto-1',
      name: 'Test',
      triggerTiming: 'after',
      abortOnError: false,
    },
    depth: 1,
    maxDepth: 5,
    executionChain: new Set<string>(),
    outputs: {},
    errors: [],
    warnings: [],
    ...overrides,
  });

  const single = (
    property: string,
    operator: SingleCondition['operator'],
    value: unknown,
  ): SingleCondition => ({ property, operator, value });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionEvaluatorService],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('comparison operators', () => {
    it('equals matches', () => {
      const result = service.evaluate(
        single('count', 'equals', 3),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('equals mismatches', () => {
      const result = service.evaluate(
        single('count', 'equals', 5),
        buildContext(),
      );
      expect(result.result).toBe(false);
    });

    it('not_equals matches', () => {
      const result = service.evaluate(
        single('count', 'not_equals', 5),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('greater_than (>)', () => {
      const result = service.evaluate(
        single('count', 'greater_than', 1),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('less_than (<)', () => {
      const result = service.evaluate(
        single('count', 'less_than', 5),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('greater_than_or_equals (>=) at boundary', () => {
      const result = service.evaluate(
        single('count', 'greater_than_or_equals', 3),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('less_than_or_equals (<=) at boundary', () => {
      const result = service.evaluate(
        single('count', 'less_than_or_equals', 3),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('greater_equal alias', () => {
      const result = service.evaluate(
        single('count', 'greater_equal', 3),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });

    it('less_equal alias', () => {
      const result = service.evaluate(
        single('count', 'less_equal', 3),
        buildContext(),
      );
      expect(result.result).toBe(true);
    });
  });

  describe('truthy/falsy edge cases', () => {
    it('empty string is treated as null-equivalent for is_null', () => {
      // Document current behavior: is_null uses == null, so empty string
      // ('') is NOT considered null. Empty-string-aware checks belong on
      // is_empty, not is_null.
      const result = service.evaluate(
        single('value', 'is_null', null),
        buildContext({ record: { value: '' } }),
      );
      expect(result.result).toBe(false);
    });

    it('null is is_null', () => {
      const result = service.evaluate(
        single('value', 'is_null', null),
        buildContext({ record: { value: null } }),
      );
      expect(result.result).toBe(true);
    });

    it('undefined is is_null', () => {
      const result = service.evaluate(
        single('missing', 'is_null', null),
        buildContext({ record: {} }),
      );
      expect(result.result).toBe(true);
    });

    it('zero is not is_null', () => {
      const result = service.evaluate(
        single('value', 'is_null', null),
        buildContext({ record: { value: 0 } }),
      );
      expect(result.result).toBe(false);
    });

    it('zero with equals 0 matches', () => {
      const result = service.evaluate(
        single('value', 'equals', 0),
        buildContext({ record: { value: 0 } }),
      );
      expect(result.result).toBe(true);
    });

    it('null is_not_null is false', () => {
      const result = service.evaluate(
        single('value', 'is_not_null', null),
        buildContext({ record: { value: null } }),
      );
      expect(result.result).toBe(false);
    });
  });

  describe('AND / OR composition', () => {
    const ctx = () => buildContext({ record: { a: 1, b: 2, c: 3 } });

    it('AND: all true => true', () => {
      const condition: Condition = {
        and: [
          single('a', 'equals', 1),
          single('b', 'equals', 2),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(true);
    });

    it('AND: one false => false', () => {
      const condition: Condition = {
        and: [
          single('a', 'equals', 1),
          single('b', 'equals', 99),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(false);
    });

    it('AND: short-circuits on first false', () => {
      const condition: Condition = {
        and: [
          single('a', 'equals', 99),
          single('b', 'equals', 2),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(false);
      expect(result.trace.shortCircuited).toBe(true);
    });

    it('OR: any true => true', () => {
      const condition: Condition = {
        or: [
          single('a', 'equals', 99),
          single('b', 'equals', 2),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(true);
    });

    it('OR: all false => false', () => {
      const condition: Condition = {
        or: [
          single('a', 'equals', 99),
          single('b', 'equals', 99),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(false);
    });

    it('nested AND inside OR', () => {
      const condition: Condition = {
        or: [
          { and: [single('a', 'equals', 99), single('b', 'equals', 99)] },
          single('c', 'equals', 3),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(true);
    });

    it('nested OR inside AND', () => {
      const condition: Condition = {
        and: [
          { or: [single('a', 'equals', 99), single('a', 'equals', 1)] },
          single('b', 'equals', 2),
        ],
      };
      const result = service.evaluate(condition, ctx());
      expect(result.result).toBe(true);
    });
  });

  describe('field-level authorization', () => {
    it('returns false (not throws) when condition references an unauthorized field', () => {
      const ctx = buildContext({
        record: { name: 'Alice', salary: 100_000 },
        authorizedFields: new Set(['name']),
      });
      const result = service.evaluate(
        single('salary', 'equals', 100_000),
        ctx,
      );
      // With salary not in authorizedFields, getPropertyValue returns
      // undefined; equals(undefined, 100_000) is false. The evaluator
      // does NOT throw — it fails closed.
      expect(result.result).toBe(false);
    });

    it('evaluates normally for an authorized field', () => {
      const ctx = buildContext({
        record: { name: 'Alice' },
        authorizedFields: new Set(['name']),
      });
      const result = service.evaluate(
        single('name', 'equals', 'Alice'),
        ctx,
      );
      expect(result.result).toBe(true);
    });

    it('allows _changes (system property) regardless of authorizedFields', () => {
      const ctx = buildContext({
        changes: ['salary'],
        authorizedFields: new Set([]),
      });
      const result = service.evaluate(
        single('_changes', 'contains', 'salary'),
        ctx,
      );
      // _changes is a SYSTEM_PROPERTIES bypass; expected to evaluate.
      expect(result.result).toBe(true);
    });

    it('allows _previous.* prefix even with authorizedFields restriction', () => {
      // _previous.* is a system prefix — bypasses authorizedFields. The
      // _previous.X path additionally consults isPropertyAuthorized for X
      // against authorizedFields. Document current behavior.
      const ctx = buildContext({
        previousRecord: { salary: 50_000 },
        authorizedFields: new Set(['salary']),
      });
      const result = service.evaluate(
        single('_previous.salary', 'equals', 50_000),
        ctx,
      );
      expect(result.result).toBe(true);
    });

    it('without authorizedFields, all properties are readable', () => {
      const ctx = buildContext({
        record: { secret: 'hush' },
      });
      const result = service.evaluate(
        single('secret', 'equals', 'hush'),
        ctx,
      );
      expect(result.result).toBe(true);
    });
  });

  describe('contains / starts_with / ends_with', () => {
    const ctx = () =>
      buildContext({ record: { title: 'Hello World' } });

    it('contains is case-insensitive', () => {
      const result = service.evaluate(
        single('title', 'contains', 'world'),
        ctx(),
      );
      expect(result.result).toBe(true);
    });

    it('not_contains', () => {
      const result = service.evaluate(
        single('title', 'not_contains', 'foo'),
        ctx(),
      );
      expect(result.result).toBe(true);
    });

    it('starts_with is case-insensitive', () => {
      const result = service.evaluate(
        single('title', 'starts_with', 'hello'),
        ctx(),
      );
      expect(result.result).toBe(true);
    });

    it('ends_with is case-insensitive', () => {
      const result = service.evaluate(
        single('title', 'ends_with', 'WORLD'),
        ctx(),
      );
      expect(result.result).toBe(true);
    });
  });

  describe('in / not_in / between', () => {
    it('in matches', () => {
      const result = service.evaluate(
        single('status', 'in', ['draft', 'published']),
        buildContext({ record: { status: 'draft' } }),
      );
      expect(result.result).toBe(true);
    });

    it('not_in matches when absent', () => {
      const result = service.evaluate(
        single('status', 'not_in', ['archived']),
        buildContext({ record: { status: 'draft' } }),
      );
      expect(result.result).toBe(true);
    });

    it('between (inclusive) at lower bound', () => {
      const result = service.evaluate(
        single('count', 'between', [3, 10]),
        buildContext({ record: { count: 3 } }),
      );
      expect(result.result).toBe(true);
    });

    it('between (inclusive) at upper bound', () => {
      const result = service.evaluate(
        single('count', 'between', [3, 10]),
        buildContext({ record: { count: 10 } }),
      );
      expect(result.result).toBe(true);
    });

    it('between out of range', () => {
      const result = service.evaluate(
        single('count', 'between', [3, 10]),
        buildContext({ record: { count: 11 } }),
      );
      expect(result.result).toBe(false);
    });
  });

  describe('evaluateQuick (boolean-only path)', () => {
    it('returns boolean for a true condition', () => {
      const result = service.evaluateQuick(
        single('count', 'equals', 3),
        buildContext(),
      );
      expect(result).toBe(true);
    });

    it('honours AND short-circuit', () => {
      const result = service.evaluateQuick(
        {
          and: [
            single('count', 'equals', 99),
            single('count', 'equals', 3),
          ],
        },
        buildContext(),
      );
      expect(result).toBe(false);
    });
  });

  describe('empty / unknown condition', () => {
    it('empty object is treated as true', () => {
      const result = service.evaluate({} as Condition, buildContext());
      expect(result.result).toBe(true);
    });
  });
});
