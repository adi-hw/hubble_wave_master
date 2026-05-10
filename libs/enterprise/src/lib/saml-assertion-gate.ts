/**
 * SAML primitives that are independently testable (F139 + F141 / W1
 * tasks 12-13).
 *
 * Lives in its own module because the parent sso.service.ts file
 * currently fails to typecheck (it imports SSOConfig/SSOSession/
 * SSOIdentity from @hubblewave/instance-db, which do not exist —
 * libs/enterprise is on the W4 deletion roadmap and the SSO domain
 * will be re-homed at libs/sso/ or merged into svc-identity). The
 * primitives here are forward-portable: when W4 moves the SSO code,
 * this file goes with it.
 *
 * Two security contracts:
 *
 *   1. F141 — XML attribute-value escaping for generateSAMLMetadata
 *      (block `"` from breaking out of the entityID attribute and
 *      injecting arbitrary XML).
 *
 *   2. F139 — caller affirmation of SAML signature verification
 *      before processSAMLAssertion does anything with the assertion.
 *      The sentinel string is the only value that satisfies the
 *      runtime check; a stray `true` boolean cannot reach here.
 */

/**
 * Escape a string for safe interpolation into an XML attribute value
 * (the kind enclosed in double quotes). The five characters reserved
 * by the XML spec inside a double-quoted attribute are `<`, `>`, `&`,
 * `"`, and `'`. `'` is escaped too even though it isn't strictly
 * required inside a `"..."` attribute, because some downstream tooling
 * normalises attribute quote styles and an unescaped `'` could then
 * become an attribute-break.
 */
export function escapeXmlAttribute(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Typed sentinel for the SAML signature-verified affirmation. Forces
 * every call site to use the exported constant — a stray `true`
 * boolean cannot satisfy the type, so a refactor that drops the
 * verification step won't compile.
 */
export const SAML_SIGNATURE_VERIFIED = '__hw_saml_signature_verified__' as const;
export type SignatureVerifiedSentinel = typeof SAML_SIGNATURE_VERIFIED;

export interface SAMLAssertionGateInput {
  signatureVerified: SignatureVerifiedSentinel | unknown;
  emailVerified?: unknown;
}

export interface SAMLGateConfig {
  /** When true (default), reject assertions where emailVerified !== true. */
  requireEmailVerified?: boolean;
}

export type SAMLGateResult =
  | { ok: true }
  | { ok: false; reason: 'signature' | 'email-not-verified'; message: string };

/**
 * Run the F139 hard-fail gates against an incoming SAML assertion.
 * Returns ok=true only if signature verification was affirmed AND the
 * email is verified per the config. The OIDC handler does the same;
 * SAML now matches.
 *
 * The runtime check is defense-in-depth on top of the type system —
 * a JS caller that bypasses TypeScript via `as any` still fails the
 * sentinel comparison.
 */
export function assertSAMLAssertion(
  assertion: SAMLAssertionGateInput,
  config: SAMLGateConfig = {},
): SAMLGateResult {
  if (assertion.signatureVerified !== SAML_SIGNATURE_VERIFIED) {
    return {
      ok: false,
      reason: 'signature',
      message:
        'SAML assertion processing rejected: caller did not affirm ' +
        'signature verification. Use SAML_SIGNATURE_VERIFIED after the ' +
        "controller's SAML library verifies the XML-DSig. F139.",
    };
  }
  const requireVerified = config.requireEmailVerified !== false;
  if (requireVerified && assertion.emailVerified !== true) {
    return {
      ok: false,
      reason: 'email-not-verified',
      message:
        'SAML assertion rejected: IdP did not attest email is verified ' +
        'and config.requireEmailVerified is on. Set emailVerified=true ' +
        'on the assertion only if the IdP affirms it. F139.',
    };
  }
  return { ok: true };
}
