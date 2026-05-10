/**
 * F139 + F141 (W1 tasks 12 + 13) regression test.
 *
 * The SAML primitives live in saml-assertion-gate.ts so the spec can
 * compile cleanly without dragging in sso.service.ts (which currently
 * fails to typecheck — libs/enterprise is on the W4 deletion roadmap;
 * SSOConfig + SSOSession + SSOIdentity entities don't exist in
 * libs/instance-db today). When W4 moves the SSO domain to libs/sso/
 * or merges it into svc-identity, this gate + spec move with it.
 *
 * F141 — XML attribute escaping.
 * F139 — signature-verified affirmation + email_verified gate.
 */

import {
  escapeXmlAttribute,
  assertSAMLAssertion,
  SAML_SIGNATURE_VERIFIED,
} from './saml-assertion-gate';

describe('escapeXmlAttribute (F141)', () => {
  it('passes through values with no reserved characters', () => {
    expect(escapeXmlAttribute('saml-config-1')).toBe('saml-config-1');
    expect(escapeXmlAttribute('https://control.example.com/sso/saml/x/metadata')).toBe(
      'https://control.example.com/sso/saml/x/metadata',
    );
  });

  it('escapes `<` and `>` (tag boundaries)', () => {
    expect(escapeXmlAttribute('a<b>c')).toBe('a&lt;b&gt;c');
  });

  it('escapes `&` (entity reference)', () => {
    expect(escapeXmlAttribute('a&b')).toBe('a&amp;b');
  });

  it('escapes `"` (attribute-value delimiter)', () => {
    expect(escapeXmlAttribute('a"b')).toBe('a&quot;b');
  });

  it('escapes `\'` defensively (downstream tooling may switch quote style)', () => {
    expect(escapeXmlAttribute("a'b")).toBe('a&apos;b');
  });

  it('escapes `&` BEFORE other entities (avoid double-escape)', () => {
    // If the order were wrong, `&lt;` would re-escape to `&amp;lt;`.
    expect(escapeXmlAttribute('<')).toBe('&lt;');
    expect(escapeXmlAttribute('a&b<c')).toBe('a&amp;b&lt;c');
  });

  it('blocks the canonical XML-injection payload `x"><Evil/>`', () => {
    // Audit cited input: an attacker controlling config.id closes the
    // entityID attribute and injects an evil element.
    const escaped = escapeXmlAttribute('x"><Evil/>');
    expect(escaped).toBe('x&quot;&gt;&lt;Evil/&gt;');
    // Plugged into `entityID="${escaped}"`, the result is
    // `entityID="x&quot;&gt;&lt;Evil/&gt;"` — a single attribute value
    // that contains the literal string, not an injected element.
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
  });

  it('handles non-string input via String() coercion', () => {
    expect(escapeXmlAttribute(42 as unknown as string)).toBe('42');
    expect(escapeXmlAttribute(null as unknown as string)).toBe('null');
  });
});

describe('assertSAMLAssertion (F139)', () => {
  it('accepts a fully-verified assertion (signature + email_verified)', () => {
    const result = assertSAMLAssertion(
      { signatureVerified: SAML_SIGNATURE_VERIFIED, emailVerified: true },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when signatureVerified is missing', () => {
    const result = assertSAMLAssertion(
      { signatureVerified: undefined, emailVerified: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('signature');
      expect(result.message).toContain('F139');
    }
  });

  it('rejects when signatureVerified is `true` boolean (defense vs `as any`)', () => {
    // Type system blocks this at compile time, but a JS caller can
    // bypass via `as any`. The runtime check still fires.
    const result = assertSAMLAssertion(
      { signatureVerified: true as unknown, emailVerified: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature');
  });

  it('rejects when signatureVerified is the string "verified" (wrong value)', () => {
    const result = assertSAMLAssertion(
      { signatureVerified: 'verified' as unknown, emailVerified: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature');
  });

  it('rejects when emailVerified is missing (default config requires it)', () => {
    const result = assertSAMLAssertion(
      { signatureVerified: SAML_SIGNATURE_VERIFIED },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('email-not-verified');
      expect(result.message).toContain('F139');
    }
  });

  it('rejects when emailVerified is false', () => {
    const result = assertSAMLAssertion(
      { signatureVerified: SAML_SIGNATURE_VERIFIED, emailVerified: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('email-not-verified');
  });

  it('accepts unverified email when config.requireEmailVerified=false', () => {
    // Operator can opt out — but this is an explicit choice, not the
    // default. The default-on stance matches OIDC's email_verified
    // handling.
    const result = assertSAMLAssertion(
      { signatureVerified: SAML_SIGNATURE_VERIFIED, emailVerified: false },
      { requireEmailVerified: false },
    );
    expect(result.ok).toBe(true);
  });

  it('signature gate fires BEFORE email gate (most security-critical first)', () => {
    // Both gates would fail this assertion. The reason MUST be
    // 'signature' so operators see the signature gap first.
    const result = assertSAMLAssertion(
      { signatureVerified: undefined, emailVerified: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('signature');
  });
});
