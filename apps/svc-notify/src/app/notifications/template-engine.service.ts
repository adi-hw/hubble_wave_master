import { Injectable, Logger } from '@nestjs/common';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

// F127 (W1 task 7): the previous renderHtml() honored a `{{{ raw }}}`
// triple-brace syntax that bypassed escapeHtml(). The intent was
// "pre-sanitized rich content" — but template authors are admins
// while the *data* fed into the slots is record-derived (and therefore
// influenced by ordinary users). A user-controlled record field with
// `<img src=x onerror=alert(1)>` becomes XSS that ships from an
// authenticated SMTP relay.
//
// The triple-brace handler is removed entirely. Templates that still
// use `{{{ }}}` get a runtime warning + safe (escaped) substitution
// — the literal `{` and `}` characters around the value will render
// in the output, making the legacy template visually broken but not
// exploitable. Operators must convert to `{{ }}` (which always
// escapes) to clean up the rendering.
const TRIPLE_BRACE_RE = /\{\{\{\s*([\w.]+)\s*\}\}\}/g;
const DOUBLE_BRACE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger(TemplateEngineService.name);
  private readonly seenTripleBraceTemplates = new Set<string>();

  /**
   * Render text-only templates (subjects, SMS, push, in-app, plaintext email).
   * Performs interpolation without HTML escaping. Suitable when the output is
   * never inserted into HTML.
   */
  renderText(template: string, data: Record<string, unknown>): string {
    if (!template) return '';
    return template.replace(DOUBLE_BRACE_RE, (_, path) => {
      const value = this.getNestedValue(data, path);
      return this.toRawString(value);
    });
  }

  /**
   * Render HTML templates. Every interpolated value is HTML-escaped.
   * The legacy `{{{ raw }}}` triple-brace syntax is no longer honored
   * (F127); see the file-level comment for rationale.
   */
  renderHtml(template: string, data: Record<string, unknown>): string {
    if (!template) return '';
    if (TRIPLE_BRACE_RE.test(template)) {
      // RegExp lastIndex carries from the .test() above; reset before
      // any subsequent .exec/.replace use of the same regex.
      TRIPLE_BRACE_RE.lastIndex = 0;
      this.warnTripleBraceUsage(template);
    }
    // Replace ALL `{{ name }}` occurrences with escaped values. Any
    // residual `{{{` becomes `{` + escaped + `}` after the replacement,
    // which is visually broken but cannot inject HTML.
    return template.replace(DOUBLE_BRACE_RE, (_, path) => {
      const value = this.getNestedValue(data, path);
      return escapeHtml(this.toRawString(value));
    });
  }

  /**
   * Log a single warning per template signature so operators can find
   * legacy templates that use `{{{ }}}`. Templates are deduped by
   * substring shape, not full text, so a high-traffic template doesn't
   * spam logs.
   */
  private warnTripleBraceUsage(template: string): void {
    const sig = template.slice(0, 80);
    if (this.seenTripleBraceTemplates.has(sig)) return;
    this.seenTripleBraceTemplates.add(sig);
    this.logger.warn(
      `Template uses {{{ raw }}} syntax which is no longer honored ` +
        `(F127). Substitutions are HTML-escaped; rewrite to use ` +
        `{{ name }} for safe output. Template starts with: ` +
        JSON.stringify(sig),
    );
  }

  /**
   * Backwards-compatible plain-text render. Equivalent to renderText.
   */
  render(template: string, data: Record<string, unknown>): string {
    return this.renderText(template, data);
  }

  private toRawString(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
