import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateEngineService {
  render(template: string, data: Record<string, unknown>): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return value === undefined || value === null ? '' : String(value);
    });
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
