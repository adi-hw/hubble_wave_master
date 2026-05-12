import { generateKid, isValidKid } from './kid';

describe('generateKid', () => {
  it('produces the canon §29.2 format hwk_YYYY_MM_DD_<8-hex>', () => {
    const kid = generateKid(new Date('2026-05-11T03:14:00Z'));
    expect(kid).toMatch(/^hwk_2026_05_11_[0-9a-f]{8}$/);
  });

  it('uses UTC year/month/day, not local-time', () => {
    // 2026-01-01T00:30:00Z is still 2026-01-01 in UTC even if local
    // timezone is GMT-12 (which would put it on 2025-12-31).
    const kid = generateKid(new Date('2026-01-01T00:30:00Z'));
    expect(kid.startsWith('hwk_2026_01_01_')).toBe(true);
  });

  it('zero-pads single-digit months and days', () => {
    const kid = generateKid(new Date('2026-03-05T12:00:00Z'));
    expect(kid.startsWith('hwk_2026_03_05_')).toBe(true);
  });

  it('produces distinct entropy across consecutive calls', () => {
    const fixed = new Date('2026-05-11T03:14:00Z');
    const set = new Set<string>();
    for (let i = 0; i < 32; i++) {
      set.add(generateKid(fixed));
    }
    // 32 random 32-bit values should never collide outside an
    // astronomically unlikely event; this catches "we forgot to call
    // randomBytes" mistakes.
    expect(set.size).toBe(32);
  });
});

describe('isValidKid', () => {
  it('accepts canonical kids', () => {
    expect(isValidKid('hwk_2026_05_11_7f3a9c2e')).toBe(true);
  });

  it('rejects uppercase hex (lowercase by contract)', () => {
    expect(isValidKid('hwk_2026_05_11_7F3A9C2E')).toBe(false);
  });

  it('rejects short entropy', () => {
    expect(isValidKid('hwk_2026_05_11_7f3a9c')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(isValidKid('hub_2026_05_11_7f3a9c2e')).toBe(false);
  });

  it('rejects unstructured strings', () => {
    expect(isValidKid('not-a-kid')).toBe(false);
    expect(isValidKid('')).toBe(false);
  });
});
