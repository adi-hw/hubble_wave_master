/**
 * Shared HTML sanitizer for `dangerouslySetInnerHTML` (F093 / W1 task 11).
 *
 * Three named profiles cover every current `dangerouslySetInnerHTML`
 * site in the app. Adding a fourth profile is the right move ONLY when
 * a new surface needs an allowlist that isn't expressible as a tighter
 * subset of an existing one — drift between profiles is the audit risk
 * this helper exists to prevent.
 *
 *   `rich-text`        — Living Docs viewer; user-authored long-form
 *                        content with formatting + lists + tables +
 *                        links. Strips scripts, on*-handlers, style,
 *                        iframe, object, embed.
 *   `ai-report`        — AI Reports viewer; tighter than rich-text.
 *                        No links (LLM-generated content shouldn't
 *                        introduce arbitrary outbound URLs into the
 *                        admin UI). Mirrors the backend sanitizer that
 *                        svc-ava applies when generating report HTML.
 *   `formula-highlight`— FormulaEditor syntax-highlighting overlay.
 *                        Only <span class="formula-*"> wrappers around
 *                        already-escaped formula text. Strips
 *                        everything else, including any class value
 *                        that doesn't match the formula-* whitelist.
 *
 * The helper exists primarily as a defense-in-depth layer + a single
 * source of truth. Callers MUST still feed already-escaped HTML for
 * the formula-highlight profile (the editor performs the escape before
 * applying syntax-highlight spans) — sanitize-html is the second lock,
 * not the first. For the other two profiles, the input is the source
 * of truth and sanitize-html does the full escaping work.
 */

import DOMPurify from 'dompurify';

export type SanitizeProfile = 'rich-text' | 'ai-report' | 'formula-highlight';

interface ProfileConfig {
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
  ALLOWED_URI_REGEXP?: RegExp;
}

const PROFILES: Record<SanitizeProfile, ProfileConfig> = {
  'rich-text': {
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div',
      'strong', 'em', 'b', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'a',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'colspan', 'rowspan'],
    // Restrict <a href> to http(s)/mailto so a sanitised payload
    // cannot smuggle javascript: or data: URIs.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  },
  'ai-report': {
    // Tighter than rich-text — no links from LLM-generated content.
    // Matches the explicit allowlist that AIReportsPage previously
    // inlined; the backend sanitizer in svc-ava follows the same
    // shape.
    ALLOWED_TAGS: [
      'p', 'span', 'strong', 'em',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3',
      'table', 'tr', 'td', 'th',
      'br',
    ],
    ALLOWED_ATTR: ['class'],
  },
  'formula-highlight': {
    // Only <span> wrappers around the editor's syntax tokens.
    // Anything else is dropped. The class attribute is allowed but
    // separately filtered (see FORMULA_CLASS_ALLOWLIST below).
    ALLOWED_TAGS: ['span'],
    ALLOWED_ATTR: ['class'],
  },
};

const FORMULA_CLASS_ALLOWLIST = new Set([
  'formula-field',
  'formula-function',
  'formula-string',
  'formula-number',
  'formula-operator',
]);

/**
 * Sanitize `content` for safe injection via `dangerouslySetInnerHTML`.
 *
 * Returns a string that is safe to assign to `__html` according to the
 * named profile's contract. For unknown profiles, returns the
 * conservative empty string (fail-closed) and logs a console.warn so
 * the misuse surfaces during development.
 */
export function sanitizeHtml(content: string, profile: SanitizeProfile): string {
  if (typeof content !== 'string' || content.length === 0) {
    return '';
  }
  const config = PROFILES[profile];
  if (!config) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sanitize-html] unknown profile "${profile}"; returning empty string. ` +
        `Add the profile to PROFILES if intentional.`,
    );
    return '';
  }

  const sanitised = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: config.ALLOWED_TAGS,
    ALLOWED_ATTR: config.ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: config.ALLOWED_URI_REGEXP,
    // Belt-and-suspenders defaults — DOMPurify drops these by default
    // but we set them explicitly so a future config change to one
    // profile doesn't accidentally re-enable script-shaped vectors.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'],
    FORBID_ATTR: ['style', 'srcdoc', 'formaction'],
  });

  if (profile === 'formula-highlight') {
    // After DOMPurify, walk the result and drop <span class> values
    // that aren't on the formula-* allowlist. Avoids a future XSS
    // vector where a token-class injection (e.g., from an LLM-
    // generated suggestion that flows into the editor) could carry
    // an unexpected class that downstream CSS treats as actionable.
    // Match the leading whitespace too so `<span class="evil">` becomes
    // `<span>` (no stray space) when no allowed class survives.
    return sanitised.replace(
      /(\s*)class="([^"]*)"/g,
      (_match, leading: string, classes: string) => {
        const allowed = classes
          .split(/\s+/)
          .filter((c) => FORMULA_CLASS_ALLOWLIST.has(c));
        if (allowed.length === 0) return '';
        return `${leading}class="${allowed.join(' ')}"`;
      },
    );
  }

  return sanitised;
}
