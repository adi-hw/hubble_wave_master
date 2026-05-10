/**
 * F093 (W1 task 11) regression — three `dangerouslySetInnerHTML` sites
 * now route through sanitizeHtml(). This spec proves each profile
 * blocks the XSS attack surface, and that the formula-highlight
 * profile preserves the editor's syntax-highlight class set.
 *
 * Runs under vitest (web-client uses vitest, not jest). jsdom is
 * supplied by vitest.config.ts. `describe/it/expect` are globals
 * (vitest config has globals: true); `vi.spyOn` is the explicit
 * vitest API for spying.
 */

import { describe, it, expect, vi } from 'vitest';
import { sanitizeHtml, SanitizeProfile } from './sanitize-html';

const ATTACK_PAYLOADS: ReadonlyArray<string> = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:alert(1)">click</a>',
  '<a href="data:text/html,<script>alert(1)</script>">click</a>',
  '<style>body { background: url("javascript:alert(1)") }</style>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)" />',
  '<form><button formaction="javascript:alert(1)">x</button></form>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)" />',
  '<link rel="stylesheet" href="javascript:alert(1)" />',
];

function assertNoExecutionVectors(out: string) {
  // The output MUST NOT contain any of these literal substrings — each
  // is a tag/attribute that, if rendered as HTML, executes script.
  const dangerous = [
    '<script',
    '<iframe',
    '<object',
    '<embed',
    '<style',
    '<meta',
    '<link',
    'javascript:',
    'onerror=',
    'onload=',
    'onclick=',
    'onmouseover=',
    'formaction=',
    'srcdoc=',
  ];
  for (const banned of dangerous) {
    expect(out.toLowerCase()).not.toContain(banned.toLowerCase());
  }
}

describe('sanitizeHtml (F093)', () => {
  describe('rich-text profile', () => {
    for (const payload of ATTACK_PAYLOADS) {
      it(`blocks ${payload.slice(0, 50).replace(/\n/g, ' ')}`, () => {
        const out = sanitizeHtml(payload, 'rich-text');
        assertNoExecutionVectors(out);
      });
    }

    it('preserves safe formatting tags', () => {
      const out = sanitizeHtml(
        '<p>Hello <strong>world</strong> and <em>others</em></p><ul><li>one</li><li>two</li></ul>',
        'rich-text',
      );
      expect(out).toContain('<p>');
      expect(out).toContain('<strong>');
      expect(out).toContain('<em>');
      expect(out).toContain('<ul>');
      expect(out).toContain('<li>one</li>');
    });

    it('preserves http(s) and mailto links', () => {
      const out = sanitizeHtml(
        '<a href="https://example.com">link</a> <a href="mailto:a@b.c">email</a>',
        'rich-text',
      );
      expect(out).toContain('href="https://example.com"');
      expect(out).toContain('href="mailto:a@b.c"');
    });

    it('strips javascript: and data: hrefs', () => {
      const out = sanitizeHtml(
        '<a href="javascript:alert(1)">x</a><a href="data:text/html,foo">y</a>',
        'rich-text',
      );
      expect(out).not.toContain('javascript:');
      expect(out).not.toContain('data:');
    });
  });

  describe('ai-report profile', () => {
    for (const payload of ATTACK_PAYLOADS) {
      it(`blocks ${payload.slice(0, 50).replace(/\n/g, ' ')}`, () => {
        const out = sanitizeHtml(payload, 'ai-report');
        assertNoExecutionVectors(out);
      });
    }

    it('strips ALL <a> tags (LLM-generated links not trusted in this profile)', () => {
      const out = sanitizeHtml(
        '<p>visit <a href="https://example.com">our site</a></p>',
        'ai-report',
      );
      expect(out).not.toContain('<a ');
      expect(out).not.toContain('href');
      // The link text is preserved (DOMPurify default behavior)
      expect(out).toContain('our site');
    });

    it('preserves report-shaped tags (table, h1-h3, lists)', () => {
      const out = sanitizeHtml(
        '<h1>Report</h1><table><tr><th>x</th></tr><tr><td>1</td></tr></table>',
        'ai-report',
      );
      expect(out).toContain('<h1>Report</h1>');
      expect(out).toContain('<table>');
      expect(out).toContain('<th>x</th>');
    });
  });

  describe('formula-highlight profile', () => {
    it('preserves <span> with allowlisted formula-* classes', () => {
      const input =
        '<span class="formula-field">{name}</span> + ' +
        '<span class="formula-function">SUM</span>(<span class="formula-number">42</span>)';
      const out = sanitizeHtml(input, 'formula-highlight');
      expect(out).toContain('class="formula-field"');
      expect(out).toContain('class="formula-function"');
      expect(out).toContain('class="formula-number"');
    });

    it('strips <span> classes that are NOT formula-*', () => {
      const out = sanitizeHtml(
        '<span class="evil danger formula-field">x</span>',
        'formula-highlight',
      );
      // Only formula-field survives; the other classes are dropped.
      expect(out).toContain('class="formula-field"');
      expect(out).not.toContain('evil');
      expect(out).not.toContain('danger');
    });

    it('removes the class attribute entirely if no allowlisted class survives', () => {
      const out = sanitizeHtml(
        '<span class="evil only-bad">x</span>',
        'formula-highlight',
      );
      // class attribute is dropped because none of its values are
      // formula-*; the empty span survives.
      expect(out).not.toContain('class=');
      expect(out).toContain('<span>');
    });

    it('strips non-<span> tags entirely', () => {
      const out = sanitizeHtml('<div>x</div><p>y</p><b>z</b>', 'formula-highlight');
      expect(out).not.toContain('<div>');
      expect(out).not.toContain('<p>');
      expect(out).not.toContain('<b>');
    });

    for (const payload of ATTACK_PAYLOADS) {
      it(`blocks ${payload.slice(0, 50).replace(/\n/g, ' ')}`, () => {
        const out = sanitizeHtml(payload, 'formula-highlight');
        assertNoExecutionVectors(out);
      });
    }
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeHtml('', 'rich-text')).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(sanitizeHtml(null as unknown as string, 'rich-text')).toBe('');
      expect(sanitizeHtml(undefined as unknown as string, 'rich-text')).toBe('');
      expect(sanitizeHtml(42 as unknown as string, 'rich-text')).toBe('');
    });

    it('returns empty string + warns for unknown profile', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });
      try {
        const out = sanitizeHtml('<p>x</p>', 'made-up' as unknown as SanitizeProfile);
        expect(out).toBe('');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('unknown profile "made-up"'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
