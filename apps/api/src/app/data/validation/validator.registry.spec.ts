import { ValidatorRegistry } from './validator.registry';

describe('ValidatorRegistry — Phase 1 §6.2 runtime registry', () => {
  it('runs a registered validator and returns its result', async () => {
    const registry = new ValidatorRegistry();
    registry.register('always_pass', () => ({ rule: 'always_pass', passed: true }));
    const result = await registry.run('always_pass', 'x', { type: 'always_pass' }, 'field', {} as never);
    expect(result.passed).toBe(true);
  });

  it('returns passing result with a warning when the validator type is unknown', async () => {
    const registry = new ValidatorRegistry();
    const result = await registry.run('does_not_exist', 'x', { type: 'does_not_exist' } as never, 'field', {} as never);
    expect(result.passed).toBe(true);
    expect(result.rule).toBe('does_not_exist');
  });

  it('overrides a registered handler when re-registered', async () => {
    const registry = new ValidatorRegistry();
    registry.register('regex', () => ({ rule: 'regex', passed: true }));
    registry.register('regex', () => ({ rule: 'regex', passed: false, message: 'overridden' }));
    const result = await registry.run('regex', 'x', { type: 'regex' } as never, 'field', {} as never);
    expect(result.passed).toBe(false);
    expect(result.message).toBe('overridden');
  });

  it('lists registered validator types deterministically (sorted)', () => {
    const registry = new ValidatorRegistry();
    registry.register('zeta', () => ({ rule: 'zeta', passed: true }));
    registry.register('alpha', () => ({ rule: 'alpha', passed: true }));
    registry.register('mu', () => ({ rule: 'mu', passed: true }));
    expect(registry.registeredTypes()).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('passes the field label and context through to the handler', async () => {
    const registry = new ValidatorRegistry();
    const seen: { label: string; ctxFlag: unknown } = { label: '', ctxFlag: undefined };
    registry.register('peek', (_v, _r, label, ctx) => {
      seen.label = label;
      seen.ctxFlag = (ctx as unknown as Record<string, unknown>).flag;
      return { rule: 'peek', passed: true };
    });
    await registry.run('peek', 'x', { type: 'peek' } as never, 'Priority', { flag: 42 } as never);
    expect(seen.label).toBe('Priority');
    expect(seen.ctxFlag).toBe(42);
  });
});
