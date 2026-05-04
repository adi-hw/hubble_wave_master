import {
  composeDisplay,
  evaluateCondition,
  type Condition,
  type DisplayAction,
} from './condition-evaluator';

describe('evaluateCondition', () => {
  describe('empty / null', () => {
    it('null condition is true', () => {
      expect(evaluateCondition(null, {})).toBe(true);
    });

    it('undefined condition is true', () => {
      expect(evaluateCondition(undefined, {})).toBe(true);
    });

    it('empty object is true', () => {
      expect(evaluateCondition({}, {})).toBe(true);
    });

    it('empty and group is true', () => {
      expect(evaluateCondition({ and: [] }, {})).toBe(true);
    });

    it('empty or group is true', () => {
      expect(evaluateCondition({ or: [] }, {})).toBe(true);
    });
  });

  describe('equals / not_equals', () => {
    it('exact string equality', () => {
      const c: Condition = { property: 'state', operator: 'equals', value: 'open' };
      expect(evaluateCondition(c, { state: 'open' })).toBe(true);
      expect(evaluateCondition(c, { state: 'closed' })).toBe(false);
    });

    it('coerces types for loose equality', () => {
      const c: Condition = { property: 'count', operator: 'equals', value: '5' };
      expect(evaluateCondition(c, { count: 5 })).toBe(true);
    });

    it('null equals null', () => {
      const c: Condition = { property: 'absent', operator: 'equals', value: null };
      expect(evaluateCondition(c, {})).toBe(true);
    });

    it('not_equals inverts', () => {
      const c: Condition = { property: 'state', operator: 'not_equals', value: 'open' };
      expect(evaluateCondition(c, { state: 'closed' })).toBe(true);
      expect(evaluateCondition(c, { state: 'open' })).toBe(false);
    });
  });

  describe('contains / not_contains', () => {
    it('string contains substring', () => {
      const c: Condition = { property: 'msg', operator: 'contains', value: 'urgent' };
      expect(evaluateCondition(c, { msg: 'this is urgent' })).toBe(true);
      expect(evaluateCondition(c, { msg: 'all good' })).toBe(false);
    });

    it('array contains element', () => {
      const c: Condition = { property: 'tags', operator: 'contains', value: 'red' };
      expect(evaluateCondition(c, { tags: ['red', 'blue'] })).toBe(true);
      expect(evaluateCondition(c, { tags: ['green', 'blue'] })).toBe(false);
    });

    it('null actual returns false (not contained)', () => {
      const c: Condition = { property: 'msg', operator: 'contains', value: 'x' };
      expect(evaluateCondition(c, {})).toBe(false);
    });
  });

  describe('starts_with / ends_with', () => {
    it('starts_with', () => {
      const c: Condition = { property: 'code', operator: 'starts_with', value: 'wo_' };
      expect(evaluateCondition(c, { code: 'wo_123' })).toBe(true);
      expect(evaluateCondition(c, { code: 'as_123' })).toBe(false);
    });

    it('ends_with', () => {
      const c: Condition = { property: 'name', operator: 'ends_with', value: '.com' };
      expect(evaluateCondition(c, { name: 'me@x.com' })).toBe(true);
      expect(evaluateCondition(c, { name: 'me@x.org' })).toBe(false);
    });
  });

  describe('numeric comparisons', () => {
    it('greater_than with numbers', () => {
      const c: Condition = { property: 'priority', operator: 'greater_than', value: 5 };
      expect(evaluateCondition(c, { priority: 7 })).toBe(true);
      expect(evaluateCondition(c, { priority: 3 })).toBe(false);
      expect(evaluateCondition(c, { priority: 5 })).toBe(false);
    });

    it('greater_than_or_equals', () => {
      const c: Condition = { property: 'priority', operator: 'greater_than_or_equals', value: 5 };
      expect(evaluateCondition(c, { priority: 5 })).toBe(true);
      expect(evaluateCondition(c, { priority: 4 })).toBe(false);
    });

    it('less_than', () => {
      const c: Condition = { property: 'priority', operator: 'less_than', value: 5 };
      expect(evaluateCondition(c, { priority: 4 })).toBe(true);
      expect(evaluateCondition(c, { priority: 5 })).toBe(false);
    });

    it('less_than_or_equals', () => {
      const c: Condition = { property: 'priority', operator: 'less_than_or_equals', value: 5 };
      expect(evaluateCondition(c, { priority: 5 })).toBe(true);
      expect(evaluateCondition(c, { priority: 6 })).toBe(false);
    });

    it('coerces string numerics', () => {
      const c: Condition = { property: 'count', operator: 'greater_than', value: '5' };
      expect(evaluateCondition(c, { count: '7' })).toBe(true);
    });
  });

  describe('null operators', () => {
    it('is_null matches missing field', () => {
      const c: Condition = { property: 'absent', operator: 'is_null' };
      expect(evaluateCondition(c, {})).toBe(true);
    });

    it('is_null matches empty string', () => {
      const c: Condition = { property: 'name', operator: 'is_null' };
      expect(evaluateCondition(c, { name: '' })).toBe(true);
    });

    it('is_null matches empty array', () => {
      const c: Condition = { property: 'tags', operator: 'is_null' };
      expect(evaluateCondition(c, { tags: [] })).toBe(true);
    });

    it('is_not_null inverts', () => {
      const c: Condition = { property: 'name', operator: 'is_not_null' };
      expect(evaluateCondition(c, { name: 'x' })).toBe(true);
      expect(evaluateCondition(c, {})).toBe(false);
    });
  });

  describe('in / not_in', () => {
    it('in matches', () => {
      const c: Condition = { property: 'state', operator: 'in', value: ['open', 'in_progress'] };
      expect(evaluateCondition(c, { state: 'open' })).toBe(true);
      expect(evaluateCondition(c, { state: 'closed' })).toBe(false);
    });

    it('not_in inverts', () => {
      const c: Condition = { property: 'state', operator: 'not_in', value: ['open', 'in_progress'] };
      expect(evaluateCondition(c, { state: 'closed' })).toBe(true);
      expect(evaluateCondition(c, { state: 'open' })).toBe(false);
    });

    it('non-array expected fails closed', () => {
      const c: Condition = { property: 'state', operator: 'in', value: 'open' };
      expect(evaluateCondition(c, { state: 'open' })).toBe(false);
    });
  });

  describe('AND/OR groups', () => {
    it('AND requires all', () => {
      const c: Condition = {
        and: [
          { property: 'a', operator: 'equals', value: 1 },
          { property: 'b', operator: 'equals', value: 2 },
        ],
      };
      expect(evaluateCondition(c, { a: 1, b: 2 })).toBe(true);
      expect(evaluateCondition(c, { a: 1, b: 3 })).toBe(false);
    });

    it('OR requires any', () => {
      const c: Condition = {
        or: [
          { property: 'a', operator: 'equals', value: 1 },
          { property: 'b', operator: 'equals', value: 2 },
        ],
      };
      expect(evaluateCondition(c, { a: 0, b: 2 })).toBe(true);
      expect(evaluateCondition(c, { a: 0, b: 0 })).toBe(false);
    });

    it('nested groups', () => {
      const c: Condition = {
        and: [
          { property: 'priority', operator: 'greater_than', value: 5 },
          {
            or: [
              { property: 'state', operator: 'equals', value: 'open' },
              { property: 'state', operator: 'equals', value: 'in_progress' },
            ],
          },
        ],
      };
      expect(evaluateCondition(c, { priority: 7, state: 'open' })).toBe(true);
      expect(evaluateCondition(c, { priority: 7, state: 'closed' })).toBe(false);
      expect(evaluateCondition(c, { priority: 3, state: 'open' })).toBe(false);
    });
  });

  describe('dotted paths', () => {
    it('walks nested objects', () => {
      const c: Condition = { property: 'user.email', operator: 'contains', value: '@hw.com' };
      expect(evaluateCondition(c, { user: { email: 'me@hw.com' } })).toBe(true);
      expect(evaluateCondition(c, { user: { email: 'me@example.org' } })).toBe(false);
    });

    it('returns undefined for missing intermediate', () => {
      const c: Condition = { property: 'user.email', operator: 'is_null' };
      expect(evaluateCondition(c, {})).toBe(true);
    });
  });

  describe('unknown operator fail-closed', () => {
    it('unknown operator returns false', () => {
      const c = { property: 'x', operator: 'wat' as never, value: 1 } as unknown as Condition;
      expect(evaluateCondition(c, { x: 1 })).toBe(false);
    });
  });
});

describe('composeDisplay', () => {
  const matchAll: Condition = {};

  const rule = (
    overrides: Partial<{
      condition: Condition | Record<string, unknown>;
      actions: DisplayAction[];
      priority: number;
      isActive: boolean;
    }>,
  ) => ({
    condition: matchAll,
    actions: [],
    priority: 100,
    isActive: true,
    ...overrides,
  });

  it('hides a field when rule matches', () => {
    const result = composeDisplay(
      [rule({ actions: [{ propertyCode: 'urgent', action: 'hide' }] })],
      {},
    );
    expect(result.hidden.has('urgent')).toBe(true);
  });

  it('higher-priority rule overrides lower', () => {
    const result = composeDisplay(
      [
        rule({
          priority: 100,
          actions: [{ propertyCode: 'urgent', action: 'hide' }],
        }),
        rule({
          priority: 50,
          actions: [{ propertyCode: 'urgent', action: 'show' }],
        }),
      ],
      {},
    );
    // priority 100 runs after priority 50, so 'hide' overrides
    expect(result.hidden.has('urgent')).toBe(true);
  });

  it('skips inactive rules', () => {
    const result = composeDisplay(
      [
        rule({ isActive: false, actions: [{ propertyCode: 'urgent', action: 'hide' }] }),
      ],
      {},
    );
    expect(result.hidden.size).toBe(0);
  });

  it('skips rules whose condition does not match', () => {
    const result = composeDisplay(
      [
        rule({
          condition: { property: 'state', operator: 'equals', value: 'open' },
          actions: [{ propertyCode: 'urgent', action: 'hide' }],
        }),
      ],
      { state: 'closed' },
    );
    expect(result.hidden.size).toBe(0);
  });

  it('mandatory and readonly compose into separate sets', () => {
    const result = composeDisplay(
      [
        rule({
          actions: [
            { propertyCode: 'a', action: 'mandatory' },
            { propertyCode: 'b', action: 'readonly' },
          ],
        }),
      ],
      {},
    );
    expect(result.mandatory.has('a')).toBe(true);
    expect(result.readonly.has('b')).toBe(true);
  });

  it('setValue populates values map', () => {
    const result = composeDisplay(
      [
        rule({
          actions: [{ propertyCode: 'a', action: 'setValue', value: 42 }],
        }),
      ],
      {},
    );
    expect(result.values.get('a')).toBe(42);
  });

  it('optional reverses mandatory in higher-priority rule', () => {
    const result = composeDisplay(
      [
        rule({
          priority: 50,
          actions: [{ propertyCode: 'a', action: 'mandatory' }],
        }),
        rule({
          priority: 100,
          actions: [{ propertyCode: 'a', action: 'optional' }],
        }),
      ],
      {},
    );
    expect(result.mandatory.has('a')).toBe(false);
  });

  it('editable reverses readonly', () => {
    const result = composeDisplay(
      [
        rule({
          priority: 50,
          actions: [{ propertyCode: 'a', action: 'readonly' }],
        }),
        rule({
          priority: 100,
          actions: [{ propertyCode: 'a', action: 'editable' }],
        }),
      ],
      {},
    );
    expect(result.readonly.has('a')).toBe(false);
  });
});
