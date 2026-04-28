import { Injectable } from '@nestjs/common';

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

@Injectable()
export class TemplateEngineService {
  /**
   * Render text-only templates (subjects, SMS, push, in-app, plaintext email).
   * Performs interpolation without HTML escaping. Suitable when the output is
   * never inserted into HTML.
   */
  renderText(template: string, data: Record<string, unknown>): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return this.toRawString(value);
    });
  }

  /**
   * Render HTML templates. Escapes every interpolated value to prevent injection
   * unless the slot uses triple-brace ({{{ raw }}}), which signals that the
   * template author has explicitly opted into raw HTML for that data field
   * (e.g. pre-sanitized rich content from an editor).
   */
  renderHtml(template: string, data: Record<string, unknown>): string {
    if (!template) return '';
    // Triple-brace must be processed before double-brace to avoid the inner
    // double-brace match consuming the value.
    const withRaw = template.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return this.toRawString(value);
    });
    return withRaw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return escapeHtml(this.toRawString(value));
    });
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
