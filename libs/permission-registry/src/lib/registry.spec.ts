import {
  PERMISSION_REGISTRY,
  PERMISSION_CODE_REGEX,
  isRegistered,
  type PermissionAction,
} from './index';

/**
 * Sanity tests for the registry shape. These are NOT runtime
 * authorization tests — they verify that every row in the constant
 * conforms to the schema documented in `registry.ts`. The
 * `permission-registry-sync-check` scanner is the call-site contract;
 * these tests are the in-table contract.
 */
describe('PERMISSION_REGISTRY (canon §28 / W2 spec §2.1)', () => {
  const VALID_ACTIONS: ReadonlyArray<PermissionAction> = [
    'read',
    'manage',
    'export',
    'configure',
    'admin',
    'invoke',
    'approve',
  ];

  /**
   * The `dangerous: true` rows are flagged in the registry so admin
   * UIs / tooling can render warnings. The flag is informational —
   * authz decisions use the explicit policy rules. This assertion is
   * a lightweight check that authors mark dangerous codes with a
   * description that hints at the danger; protects against silent
   * downgrades where someone toggles `dangerous: false` without
   * updating the description.
   */
  const DANGEROUS_HINT_WORDS = [
    'dangerous',
    'admin',
    'delete',
    'manage',
    'export',
    'configure',
    'authorization',
  ];

  it('is non-empty', () => {
    expect(PERMISSION_REGISTRY.length).toBeGreaterThan(0);
  });

  it('every code matches PERMISSION_CODE_REGEX', () => {
    for (const entry of PERMISSION_REGISTRY) {
      expect(entry.code).toMatch(PERMISSION_CODE_REGEX);
    }
  });

  it('every action is in the PermissionAction enum', () => {
    for (const entry of PERMISSION_REGISTRY) {
      expect(VALID_ACTIONS).toContain(entry.action);
    }
  });

  it('every plane is `instance` or `control-plane`', () => {
    for (const entry of PERMISSION_REGISTRY) {
      expect(['instance', 'control-plane']).toContain(entry.plane);
    }
  });

  it('codes are unique', () => {
    const seen = new Set<string>();
    for (const entry of PERMISSION_REGISTRY) {
      expect(seen.has(entry.code)).toBe(false);
      seen.add(entry.code);
    }
  });

  it('every description is non-empty', () => {
    for (const entry of PERMISSION_REGISTRY) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('dangerous entries have a description that hints at the danger', () => {
    for (const entry of PERMISSION_REGISTRY) {
      if (!entry.dangerous) continue;
      const desc = entry.description.toLowerCase();
      const hit = DANGEROUS_HINT_WORDS.some((w) => desc.includes(w));
      expect(hit).toBe(true);
    }
  });

  it('PERMISSION_CODE_REGEX rejects malformed codes', () => {
    // The registry contains only well-formed codes; here we exercise
    // the regex with known-bad shapes so a future loosening of the
    // pattern is caught by a failing test.
    const badShapes = [
      '',
      'Audit:Read',
      'audit-read',
      'audit:',
      ':read',
      'audit:read:write:export',
      'AUDIT_READ',
      '0audit:read',
    ];
    for (const shape of badShapes) {
      expect(shape).not.toMatch(PERMISSION_CODE_REGEX);
    }
  });

  it('isRegistered returns true for known codes and false otherwise', () => {
    expect(isRegistered('audit:read')).toBe(true);
    expect(isRegistered('does:not:exist')).toBe(false);
    expect(isRegistered('')).toBe(false);
  });
});
