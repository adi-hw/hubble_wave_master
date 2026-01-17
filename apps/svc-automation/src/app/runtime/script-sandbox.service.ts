import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Parser } from 'expr-eval';
import { ExecutionContext } from './automation-runtime.types';

interface ScriptResult {
  output: unknown;
  changes?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

const SAFE_FUNCTIONS = {
  length: (s: unknown) => String(s ?? '').length,
  upper: (s: unknown) => String(s ?? '').toUpperCase(),
  lower: (s: unknown) => String(s ?? '').toLowerCase(),
  trim: (s: unknown) => String(s ?? '').trim(),
  substring: (s: unknown, start: number, end?: number) => String(s ?? '').substring(start, end),
  indexOf: (s: unknown, search: string) => String(s ?? '').indexOf(search),
  startsWith: (s: unknown, search: string) => String(s ?? '').startsWith(search),
  endsWith: (s: unknown, search: string) => String(s ?? '').endsWith(search),
  contains: (s: unknown, search: string) => String(s ?? '').includes(search),
  replace: (s: unknown, search: string, replacement: string) => String(s ?? '').replace(search, replacement),
  split: (s: unknown, delimiter: string) => String(s ?? '').split(delimiter),
  join: (arr: unknown[], delimiter: string) => arr.join(delimiter),
  concat: (...args: unknown[]) => args.map((a) => String(a ?? '')).join(''),
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().split('T')[0],
  parseDate: (s: unknown) => new Date(String(s)).toISOString(),
  formatDate: (s: unknown, format?: string) => {
    const d = new Date(String(s));
    if (isNaN(d.getTime())) return '';
    if (format === 'date') return d.toISOString().split('T')[0];
    if (format === 'time') return d.toTimeString().split(' ')[0];
    return d.toISOString();
  },
  daysBetween: (d1: unknown, d2: unknown) => {
    const date1 = new Date(String(d1));
    const date2 = new Date(String(d2));
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  },
  isNull: (v: unknown) => v === null || v === undefined,
  isEmpty: (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
  isNumber: (v: unknown) => typeof v === 'number' && !isNaN(v),
  isString: (v: unknown) => typeof v === 'string',
  isArray: (v: unknown) => Array.isArray(v),
  toString: (v: unknown) => String(v ?? ''),
  toNumber: (v: unknown) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  },
  toBoolean: (v: unknown) => Boolean(v),
  count: (arr: unknown) => (Array.isArray(arr) ? arr.length : 0),
  first: (arr: unknown) => (Array.isArray(arr) ? arr[0] : undefined),
  last: (arr: unknown) => (Array.isArray(arr) ? arr[arr.length - 1] : undefined),
  includes: (arr: unknown, item: unknown) => (Array.isArray(arr) ? arr.includes(item) : false),
  iif: (condition: boolean, trueValue: unknown, falseValue: unknown) =>
    condition ? trueValue : falseValue,
  coalesce: (...args: unknown[]) => args.find((a) => a !== null && a !== undefined),
};

const BLOCKED_PATTERNS = [
  /\beval\b/i,
  /\bFunction\b/i,
  /\bprocess\b/i,
  /\brequire\b/i,
  /\bimport\b/i,
  /\bglobal\b/i,
  /\bwindow\b/i,
  /\bdocument\b/i,
  /\bconstructor\b/i,
  /\b__proto__\b/i,
  /\bprototype\b/i,
  /\bthis\b/i,
  /\bnew\s+/i,
  /\bdelete\b/i,
  /\btypeof\b/i,
  /\binstanceof\b/i,
  /\bwith\b/i,
  /\[\s*['\"`].*['\"`]\s*\]/,
  /\bfetch\b/i,
  /\bXMLHttpRequest\b/i,
  /\bWebSocket\b/i,
  /\bsetTimeout\b/i,
  /\bsetInterval\b/i,
  /\bPromise\b/i,
  /\basync\b/i,
  /\bawait\b/i,
];

@Injectable()
export class ScriptSandboxService {
  private readonly logger = new Logger(ScriptSandboxService.name);
  private readonly parser: Parser;

  constructor() {
    this.parser = new Parser({
      operators: {
        in: false,
        assignment: false,
      },
    });

    for (const [name, fn] of Object.entries(SAFE_FUNCTIONS)) {
      this.parser.functions[name] = fn;
    }
  }

  private validateScript(script: string): void {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(script)) {
        throw new BadRequestException(
          `Script contains blocked pattern: ${pattern.source}. Only safe expressions are allowed.`,
        );
      }
    }

    if (script.length > 10000) {
      throw new BadRequestException('Script exceeds maximum allowed length (10000 characters)');
    }

    if (/[<>]/.test(script)) {
      throw new BadRequestException('Script contains potentially unsafe characters');
    }
  }

  async execute(
    script: string,
    context: ExecutionContext,
    _timeoutMs = 1000,
  ): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      this.validateScript(script);
      const expression = this.parser.parse(script);

      const variables: Record<string, unknown> = {
        record: { ...context.record },
        previous: context.previousRecord ? { ...context.previousRecord } : {},
        userId: context.user?.id,
        userEmail: context.user?.email,
        userRoles: context.user?.roles || [],
        isCreate: !context.previousRecord,
        isUpdate: !!context.previousRecord,
        null: null,
        true: true,
        false: false,
      };

      for (const [key, value] of Object.entries(context.record || {})) {
        variables[key] = value;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = expression.evaluate(variables as any);

      let changes: Record<string, unknown> | undefined;
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        changes = {};
        for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
          if (JSON.stringify(value) !== JSON.stringify(context.record[key])) {
            changes[key] = value;
          }
        }
        if (Object.keys(changes).length === 0) {
          changes = undefined;
        }
      }

      return {
        output: result,
        changes,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn(`Script execution failed: ${(error as Error).message}`);
      return {
        output: null,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  evaluateCondition(
    condition: string,
    record: Record<string, unknown>,
    previousRecord?: Record<string, unknown>,
  ): boolean {
    try {
      this.validateScript(condition);
      const expression = this.parser.parse(condition);

      const variables: Record<string, unknown> = {
        record,
        previous: previousRecord || {},
        isCreate: !previousRecord,
        isUpdate: !!previousRecord,
        null: null,
        true: true,
        false: false,
      };

      for (const [key, value] of Object.entries(record)) {
        variables[key] = value;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Boolean(expression.evaluate(variables as any));
    } catch (error) {
      this.logger.error(`Condition evaluation failed: ${(error as Error).message}`);
      return false;
    }
  }
}
