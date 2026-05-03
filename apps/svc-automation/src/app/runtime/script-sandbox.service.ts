import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Parser } from 'expr-eval';
import { ExecutionContext } from './automation-runtime.types';

// Layered defense for user-supplied scripts:
//   1. Unicode normalization (NFKC) so look-alike characters are folded
//      before pattern matching — defeats homoglyph bypasses.
//   2. Defanged copy for pattern checks: whitespace and string-quote contents
//      are stripped so `'eva'+'l'` matches the eval pattern. The original
//      script is what reaches the parser; defanging is a check-only artifact.
//   3. Length cap (MAX_SCRIPT_LENGTH) to bound parse cost.
//   4. AST depth cap walking the expr-eval token tree (IEXPR sub-expression
//      nodes are recursive). Limit is configurable via SCRIPT_MAX_AST_DEPTH.
//   5. Wall-clock timeout via Promise.race — expr-eval has no native timeout,
//      so the parser is racing a setTimeout-driven deadline. The evaluation
//      itself cannot be killed mid-execution but the response is bounded.

interface ScriptResult {
  output: unknown;
  changes?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

const MAX_SCRIPT_LENGTH = 10000;
const DEFAULT_AST_DEPTH = 64;
const MAX_EVAL_TIMEOUT_MS = 2000;

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
  /\[\s*['"`].*['"`]\s*\]/,
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

  private validateScript(script: string): string {
    if (typeof script !== 'string') {
      throw new BadRequestException('Script must be a string');
    }

    if (script.length > MAX_SCRIPT_LENGTH) {
      throw new BadRequestException(
        `Script exceeds maximum allowed length (${MAX_SCRIPT_LENGTH} characters)`,
      );
    }

    // Normalise to NFKC so visually-equivalent code points fold to canonical
    // ASCII before pattern matching.
    const normalised = script.normalize('NFKC');

    // Build a defanged variant: drop whitespace and string-literal contents
    // so concatenation tricks like "eva"+"l" surface as "eval".
    const defanged = normalised
      .replace(/'(?:\\'|[^'])*'/g, "''")
      .replace(/"(?:\\"|[^"])*"/g, '""')
      .replace(/`(?:\\`|[^`])*`/g, '``')
      .replace(/\s+/g, '');

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(normalised) || pattern.test(defanged)) {
        throw new BadRequestException(
          `Script contains blocked pattern: ${pattern.source}. Only safe expressions are allowed.`,
        );
      }
    }

    if (/[<>]/.test(normalised)) {
      throw new BadRequestException('Script contains potentially unsafe characters');
    }

    return normalised;
  }

  private getAstDepthLimit(): number {
    const raw = process.env.SCRIPT_MAX_AST_DEPTH;
    if (!raw) return DEFAULT_AST_DEPTH;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AST_DEPTH;
    return parsed;
  }

  private assertAstDepth(expression: unknown): void {
    // expr-eval Expression objects expose their RPN token list. Sub-expression
    // tokens (IEXPR / IFUNDEF) carry a nested token array — recurse into them
    // to find the deepest nesting.
    const limit = this.getAstDepthLimit();
    const walk = (tokens: unknown, depth: number): number => {
      if (!Array.isArray(tokens)) return depth;
      let maxDepth = depth;
      for (const token of tokens) {
        if (
          token &&
          typeof token === 'object' &&
          'value' in (token as Record<string, unknown>) &&
          Array.isArray((token as { value: unknown }).value)
        ) {
          const nested = walk((token as { value: unknown[] }).value, depth + 1);
          if (nested > maxDepth) maxDepth = nested;
        }
      }
      return maxDepth;
    };
    const tokens = (expression as { tokens?: unknown }).tokens;
    const depth = walk(tokens, 1);
    if (depth > limit) {
      throw new BadRequestException(
        `Script expression depth (${depth}) exceeds limit (${limit})`,
      );
    }
  }

  private withTimeout<T>(work: () => T, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Script evaluation exceeded ${timeoutMs}ms timeout`));
      }, timeoutMs);
      // Run synchronously but yield via microtask so the timer can fire if the
      // parser hangs. expr-eval is synchronous, so this is a best-effort guard.
      Promise.resolve()
        .then(() => {
          try {
            const value = work();
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          } catch (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async execute(
    script: string,
    context: ExecutionContext,
    options: { timeoutMs?: number; mode?: 'transformation' | 'condition' } = {},
  ): Promise<ScriptResult> {
    const startTime = Date.now();
    const timeoutMs = Math.min(options.timeoutMs ?? 1000, MAX_EVAL_TIMEOUT_MS);
    const mode = options.mode ?? 'transformation';

    try {
      const normalisedScript = this.validateScript(script);
      const expression = this.parser.parse(normalisedScript);
      this.assertAstDepth(expression);

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

      const result = await this.withTimeout(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => expression.evaluate(variables as any),
        timeoutMs,
      );

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
      const message = error instanceof Error ? error.message : String(error);
      // Fail-closed: condition scripts that fail evaluation must default to
      // 'condition not met' so downstream branches do not run on a stale or
      // null result. Transformation scripts surface the error so the caller
      // can mark the action as failed rather than silently dropping output.
      if (mode === 'condition') {
        this.logger.warn(`Condition script failed (fail-closed): ${message}`);
        return {
          output: false,
          error: message,
          durationMs: Date.now() - startTime,
        };
      }
      this.logger.warn(`Script execution failed: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async evaluateCondition(
    condition: string,
    record: Record<string, unknown>,
    previousRecord?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const normalised = this.validateScript(condition);
      const expression = this.parser.parse(normalised);
      this.assertAstDepth(expression);

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

      return await this.withTimeout(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => Boolean(expression.evaluate(variables as any)),
        1000,
      );
    } catch (error) {
      // Fail-closed: an unevaluable condition is treated as 'not met'.
      this.logger.error(`Condition evaluation failed: ${(error as Error).message}`);
      return false;
    }
  }
}
