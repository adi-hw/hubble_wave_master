import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionContext } from '../../types/automation.types';

// Tests for the W4.B port of W3.A's SAFE_FUNCTIONS shadowing fix to the
// svc-data sandbox copy. Record fields whose names collide with registered
// SAFE_FUNCTIONS (count, length, iif, min, max, first, last, ...) used to
// be shadowed by the function reference because expr-eval's IVAR resolver
// checks `parser.functions` before the values scope. The
// resolveScopePrecedence pass rewrites value-site IVAR tokens to a sentinel
// scope key so the field value wins; function-call syntax still routes to
// SAFE_FUNCTIONS unchanged.

function makeContext(record: Record<string, unknown>): ExecutionContext {
  return {
    user: { id: 'user-1', email: 'u@example.com', roles: [] },
    record,
    previousRecord: undefined,
    changes: [],
    automation: {
      id: 'auto-1',
      name: 'Test Automation',
      triggerTiming: 'after',
      abortOnError: false,
    },
    depth: 0,
    maxDepth: 5,
    executionChain: [],
    recordsModified: new Map(),
    outputs: {},
    asyncQueue: [],
    errors: [],
    warnings: [],
  };
}

describe('ScriptSandboxService — record fields shadowing SAFE_FUNCTIONS (W4.B)', () => {
  let service: ScriptSandboxService;

  beforeEach(() => {
    service = new ScriptSandboxService();
  });

  describe('evaluateCondition', () => {
    it('record property "count" should be readable as a value', () => {
      expect(service.evaluateCondition('count == 3', { count: 3 })).toBe(true);
    });

    it('record property "length" should be readable as a value', () => {
      expect(service.evaluateCondition('length == 5', { length: 5 })).toBe(true);
    });

    it('record property "min" should be readable as a value', () => {
      expect(service.evaluateCondition('min == 10', { min: 10 })).toBe(true);
    });

    it('record property "max" should be readable as a value', () => {
      expect(service.evaluateCondition('max == 99', { max: 99 })).toBe(true);
    });

    it('record property "first" should be readable as a value', () => {
      expect(service.evaluateCondition('first == 1', { first: 1 })).toBe(true);
    });

    it('record property "last" should be readable as a value', () => {
      expect(service.evaluateCondition('last == 9', { last: 9 })).toBe(true);
    });

    it('record property "iif" should be readable as a value', () => {
      expect(service.evaluateCondition('iif == 42', { iif: 42 })).toBe(true);
    });

    it('still calls length(value) correctly when used as a function', () => {
      expect(service.evaluateCondition('length("foo") == 3', {})).toBe(true);
    });

    it('still calls min(a, b) correctly when used as a function', () => {
      expect(service.evaluateCondition('min(1, 2) == 1', {})).toBe(true);
    });

    it('still calls max(a, b) correctly when used as a function', () => {
      expect(service.evaluateCondition('max(1, 2) == 2', {})).toBe(true);
    });

    it('mixed: function call and shadowed field in same expression', () => {
      // length("abc") = 3, plus the field length=7 = 10
      expect(
        service.evaluateCondition('length("abc") + length == 10', { length: 7 }),
      ).toBe(true);
    });

    it('returns false (not crashes) when shadowed field has wrong value', () => {
      expect(service.evaluateCondition('count == 3', { count: 99 })).toBe(false);
    });

    it('does not affect non-colliding record fields', () => {
      expect(
        service.evaluateCondition('foo + bar == 15', { foo: 5, bar: 10 }),
      ).toBe(true);
    });
  });

  describe('execute', () => {
    it('record property "count" resolves as a value, not the function reference', async () => {
      const result = await service.execute('count', makeContext({ count: 3 }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(3);
    });

    it('record property "length" resolves as a value', async () => {
      const result = await service.execute('length', makeContext({ length: 5 }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(5);
    });

    it('record property "min" resolves as a value', async () => {
      const result = await service.execute('min', makeContext({ min: 10 }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(10);
    });

    it('record property "max" resolves as a value', async () => {
      const result = await service.execute('max', makeContext({ max: 99 }));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(99);
    });

    it('count(items) still calls the SAFE_FUNCTIONS helper', async () => {
      const result = await service.execute(
        'count(items)',
        makeContext({ items: [1, 2, 3, 4] }),
      );
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(4);
    });

    it('length("hello") still calls the SAFE_FUNCTIONS helper', async () => {
      const result = await service.execute('length("hello")', makeContext({}));
      expect(result.error).toBeUndefined();
      expect(result.output).toBe(5);
    });

    it('iif(cond, t, f) still resolves as a function call', async () => {
      const result = await service.execute(
        'iif(true, "yes", "no")',
        makeContext({}),
      );
      expect(result.error).toBeUndefined();
      expect(result.output).toBe('yes');
    });
  });
});
