import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionContext } from './automation-runtime.types';

function makeContext(record: Record<string, unknown>): ExecutionContext {
  return {
    user: { id: 'user-1', email: 'u@example.com', roles: [] },
    record,
    previousRecord: null,
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
    outputs: {},
    errors: [],
    warnings: [],
  };
}

describe('ScriptSandboxService — record fields shadowing SAFE_FUNCTIONS (W3.A)', () => {
  let service: ScriptSandboxService;

  beforeEach(() => {
    service = new ScriptSandboxService();
  });

  describe('evaluateCondition', () => {
    // Originally documented as it.skip in the W1.9 characterization suite:
    // record property "count" should be readable as a value, but expr-eval
    // resolved bare `count` to the SAFE_FUNCTIONS function reference, so the
    // condition `count == 3` was always false against the function object.
    it('record property "count" should be readable as a value', () => {
      const result = service.evaluateCondition('count == 3', { count: 3 });
      expect(result).toBe(true);
    });

    it('record property "length" should be readable as a value', () => {
      const result = service.evaluateCondition('length == 5', { length: 5 });
      expect(result).toBe(true);
    });

    it('record property "min" should be readable as a value', () => {
      const result = service.evaluateCondition('min == 10', { min: 10 });
      expect(result).toBe(true);
    });

    it('record property "max" should be readable as a value', () => {
      const result = service.evaluateCondition('max == 99', { max: 99 });
      expect(result).toBe(true);
    });

    it('record property "first" should be readable as a value', () => {
      const result = service.evaluateCondition('first == 1', { first: 1 });
      expect(result).toBe(true);
    });

    it('record property "last" should be readable as a value', () => {
      const result = service.evaluateCondition('last == 9', { last: 9 });
      expect(result).toBe(true);
    });

    it('record property "iif" should be readable as a value', () => {
      const result = service.evaluateCondition('iif == 42', { iif: 42 });
      expect(result).toBe(true);
    });

    it('still calls length(value) correctly when used as a function', () => {
      const result = service.evaluateCondition('length("foo") == 3', {});
      expect(result).toBe(true);
    });

    it('still calls min(a, b) correctly when used as a function', () => {
      const result = service.evaluateCondition('min(1, 2) == 1', {});
      expect(result).toBe(true);
    });

    it('mixed: function call and shadowed field in same expression', () => {
      // length("abc") = 3, plus the field length=7 = 10
      const ctx = { length: 7 };
      const result = service.evaluateCondition('length("abc") + length == 10', ctx);
      expect(result).toBe(true);
    });

    it('returns false (not crashes) when shadowed field has wrong value', () => {
      const result = service.evaluateCondition('count == 3', { count: 99 });
      expect(result).toBe(false);
    });

    it('does not affect non-colliding record fields', () => {
      const result = service.evaluateCondition('foo + bar == 15', { foo: 5, bar: 10 });
      expect(result).toBe(true);
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
