/**
 * F091 — Field-level masking helper. The backend marks sensitive
 * fields with maskingStrategy='PARTIAL' or 'FULL' on the resolved
 * view's fieldPermissions; this helper is what the form renderer
 * calls to transform the displayed value.
 *
 * Vitest config (apps/web-client/vitest.config.ts) sets globals: true,
 * so describe/it/expect are global. jsdom is configured too but this
 * helper is DOM-agnostic.
 */

import { describe, it, expect } from 'vitest';
import { applyMask } from './apply-mask';

describe('applyMask (F091)', () => {
  describe('strategy: NONE', () => {
    it('returns the value unchanged for strings', () => {
      expect(applyMask('hello', 'NONE')).toBe('hello');
    });

    it('returns the value unchanged for numbers', () => {
      expect(applyMask(42, 'NONE')).toBe(42);
    });

    it('returns the value unchanged for null', () => {
      expect(applyMask(null, 'NONE')).toBeNull();
    });

    it('returns the value unchanged for undefined', () => {
      expect(applyMask(undefined, 'NONE')).toBeUndefined();
    });

    it('returns the value unchanged for booleans', () => {
      expect(applyMask(true, 'NONE')).toBe(true);
      expect(applyMask(false, 'NONE')).toBe(false);
    });

    it('returns the value unchanged for empty strings', () => {
      expect(applyMask('', 'NONE')).toBe('');
    });
  });

  describe('strategy: FULL', () => {
    it("returns '••••••' for a populated string", () => {
      expect(applyMask('secret-value', 'FULL')).toBe('••••••');
    });

    it("returns '••••••' for a number", () => {
      expect(applyMask(123456, 'FULL')).toBe('••••••');
    });

    it("returns '••••••' for a boolean", () => {
      expect(applyMask(true, 'FULL')).toBe('••••••');
    });

    it('preserves null (nothing to mask)', () => {
      expect(applyMask(null, 'FULL')).toBeNull();
    });

    it('preserves undefined (nothing to mask)', () => {
      expect(applyMask(undefined, 'FULL')).toBeUndefined();
    });

    it('preserves empty strings (no leakage to mask)', () => {
      expect(applyMask('', 'FULL')).toBe('');
    });
  });

  describe('strategy: PARTIAL', () => {
    it("returns '•••••6789' for '123456789' (last 4 preserved)", () => {
      expect(applyMask('123456789', 'PARTIAL')).toBe('••••••6789');
    });

    it('preserves the last 4 chars for a 4-character string (full mask + tail)', () => {
      // Length 4 is the minimum; tail is the whole string. The prefix
      // is empty, so the visible portion equals the original — this is
      // documented behavior: with a 4-char identifier the caller has
      // declared PARTIAL is acceptable.
      expect(applyMask('1234', 'PARTIAL')).toBe('••••••1234');
    });

    it("returns '••••••' for a short string 'abc' (length < 4, full mask)", () => {
      expect(applyMask('abc', 'PARTIAL')).toBe('••••••');
    });

    it("returns '••••••' for a 1-character string", () => {
      expect(applyMask('a', 'PARTIAL')).toBe('••••••');
    });

    it("returns '••••••' for a number (numbers can't partial-mask safely)", () => {
      expect(applyMask(123456789, 'PARTIAL')).toBe('••••••');
    });

    it("returns '••••••' for a boolean (booleans can't partial-mask)", () => {
      expect(applyMask(true, 'PARTIAL')).toBe('••••••');
      expect(applyMask(false, 'PARTIAL')).toBe('••••••');
    });

    it("returns '••••••' for an object (objects can't partial-mask)", () => {
      expect(applyMask({ secret: 'value' }, 'PARTIAL')).toBe('••••••');
    });

    it('preserves null', () => {
      expect(applyMask(null, 'PARTIAL')).toBeNull();
    });

    it('preserves undefined', () => {
      expect(applyMask(undefined, 'PARTIAL')).toBeUndefined();
    });

    it('preserves empty string', () => {
      expect(applyMask('', 'PARTIAL')).toBe('');
    });

    it('partial-masks a long identifier preserving exactly 4 trailing chars', () => {
      const ssn = '123-45-6789';
      const out = applyMask(ssn, 'PARTIAL') as string;
      expect(out.endsWith('6789')).toBe(true);
      expect(out.length).toBe('••••••'.length + 4);
    });
  });
});
