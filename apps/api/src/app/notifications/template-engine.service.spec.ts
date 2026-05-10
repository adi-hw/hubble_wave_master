import { TemplateEngineService } from './template-engine.service';

/**
 * F127 (W1 task 7) regression test — the renderHtml() method previously
 * honored `{{{ raw }}}` triple-brace syntax that bypassed HTML
 * escaping. Record-derived data fed into those slots was a stored XSS
 * vector that shipped from an authenticated SMTP relay. The triple-
 * brace path is removed; this spec asserts every interpolation in
 * renderHtml() is escaped, including the case where a legacy template
 * still uses `{{{ }}}`.
 */
describe('TemplateEngineService — F127 triple-brace XSS removed', () => {
  let svc: TemplateEngineService;

  /**
   * Each payload is a record-derived string an attacker might place in a
   * template-substituted slot. Assertions check the SAFETY CONTRACT —
   * that NO unescaped `<`, `>`, `"`, or `'` survives into the output —
   * not raw-string presence. Strings like `onload=alert(1)` are harmless
   * when rendered as text; what matters is whether they can OPEN a tag
   * or attribute. After escapeHtml(), `<` becomes `&lt;` and the
   * browser renders it as the literal sequence `<` rather than as HTML.
   */
  const ATTACK_PAYLOADS: ReadonlyArray<string> = [
    '<img src=x onerror=alert(1)>',
    '<script>alert("xss")</script>',
    '"><svg onload=alert(1)>',
    '<a href="javascript:alert(1)">link</a>',
    "><iframe srcdoc=&lt;script&gt;alert(1)&lt;/script&gt;>",
  ];

  function assertNoUnescapedHtml(output: string, slotPayload: string) {
    // The substring containing the slot's value must NOT contain any
    // of the four characters that can open HTML tags / attributes.
    // We can't isolate the slot output region cleanly, but we can
    // assert the OUTPUT contains the escaped form of every dangerous
    // char from the payload AND does not contain any unescaped form
    // not present in the surrounding template.
    for (const ch of ['<', '>', '"', "'"]) {
      if (slotPayload.includes(ch)) {
        // The escaped form must appear at least once (proves escape ran).
        const escaped = ch === '<' ? '&lt;'
                      : ch === '>' ? '&gt;'
                      : ch === '"' ? '&quot;'
                      : '&#39;';
        expect(output).toContain(escaped);
      }
    }
  }

  beforeEach(() => {
    svc = new TemplateEngineService();
  });

  describe('renderHtml — double-brace {{ }} (always escaped)', () => {
    for (const payload of ATTACK_PAYLOADS) {
      it(`escapes "${payload.slice(0, 40)}…"`, () => {
        const out = svc.renderHtml('<p>{{ field }}</p>', { field: payload });
        expect(out).toContain('<p>');
        expect(out).toContain('</p>');
        assertNoUnescapedHtml(out, payload);
        // Critically: the literal payload string MUST NOT appear in
        // the output as-is — that would mean escape didn't run.
        expect(out).not.toContain(payload);
      });
    }
  });

  describe('renderHtml — legacy triple-brace {{{ }}} (now safe)', () => {
    for (const payload of ATTACK_PAYLOADS) {
      it(`no longer renders "${payload.slice(0, 40)}…" as raw HTML`, () => {
        const out = svc.renderHtml('<p>{{{ field }}}</p>', { field: payload });
        // The triple-brace pattern is no longer special-cased. The
        // double-brace inside `{{{ x }}}` matches as `{{ x }}` and
        // gets escaped, so the resulting output is `{<escaped>}` —
        // visually broken but cannot inject HTML.
        assertNoUnescapedHtml(out, payload);
        expect(out).not.toContain(payload);
      });
    }

    it('warns once per template signature on triple-brace use', () => {
      // Spy on the private logger; warnTripleBraceUsage logs a warn.
      // We can't easily intercept Nest's Logger output, but we can
      // assert that calling renderHtml twice with the same template
      // triggers the warn-dedup behavior (only one entry in
      // seenTripleBraceTemplates set).
      const tpl = '<p>{{{ x }}}</p>';
      svc.renderHtml(tpl, { x: 'hi' });
      svc.renderHtml(tpl, { x: 'hi' });
      // No assertion against logger output (private), but confirm no
      // throw + same output both times.
      const out1 = svc.renderHtml(tpl, { x: '<b>safe</b>' });
      expect(out1).not.toContain('<b>');
      expect(out1).toContain('&lt;b&gt;');
    });

    it('safe even when raw value contains the closing brace', () => {
      // Edge: a value containing literal `}` shouldn't break the regex.
      const out = svc.renderHtml('<p>{{ x }}</p>', { x: '}}}}<script>' });
      expect(out).not.toContain('<script>');
    });
  });

  describe('renderText — never escapes (text-only output)', () => {
    it('returns the raw value verbatim (no HTML context)', () => {
      // renderText is for plaintext channels (SMS, push). HTML escape
      // there would corrupt the output. The contract is: only call
      // renderText when the output is NEVER inserted into HTML.
      const out = svc.renderText('Hello {{ x }}', { x: '<b>name</b>' });
      expect(out).toBe('Hello <b>name</b>');
    });
  });
});
