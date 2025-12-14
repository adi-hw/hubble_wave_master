import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export interface SandboxConfig {
  timeoutMs?: number;
  memoryLimitMb?: number;
  allowedModules?: string[];
  allowHttpCalls?: boolean;
  allowDbQueries?: boolean;
}

export interface SandboxContext {
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  input?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  user?: { id: string; [key: string]: unknown };
  changedFields?: string[];
}

export interface SandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
  executionTimeMs: number;
}

/**
 * Provides a secure sandbox for executing user-defined scripts.
 * Uses Node.js vm module with strict limitations.
 */
@Injectable()
export class ScriptSandboxService {
  private readonly logger = new Logger(ScriptSandboxService.name);
  private readonly defaultTimeout = 5000; // 5 seconds
  private readonly maxTimeout = 30000; // 30 seconds

  /**
   * Execute a script in a sandboxed environment
   */
  async execute(
    script: string,
    context: SandboxContext,
    config: SandboxConfig = {}
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const timeout = Math.min(config.timeoutMs || this.defaultTimeout, this.maxTimeout);

    try {
      // Build safe context with limited APIs
      const sandbox = this.buildSandbox(context, config, logs);

      // Wrap script in async IIFE
      const wrappedScript = `
        (async function() {
          "use strict";
          ${script}
        })();
      `;

      // Create VM context
      const vmContext = vm.createContext(sandbox, {
        codeGeneration: {
          strings: false, // Disable eval()
          wasm: false,    // Disable WebAssembly
        },
      });

      // Compile and run script
      const vmScript = new vm.Script(wrappedScript, {
        filename: 'sandbox-script.js',
      });

      const result = await vmScript.runInContext(vmContext, {
        timeout,
        breakOnSigint: true,
      });

      return {
        success: true,
        result,
        logs,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      this.logger.warn(`Script execution failed: ${error.message}`);

      return {
        success: false,
        error: this.sanitizeError(error),
        logs,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate script syntax without executing
   */
  validateScript(script: string): { valid: boolean; error?: string } {
    try {
      new vm.Script(`(async function() { ${script} })();`, {
        filename: 'validation.js',
      });
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Build the sandbox context with safe APIs
   */
  private buildSandbox(
    context: SandboxContext,
    config: SandboxConfig,
    logs: string[]
  ): Record<string, unknown> {
    const sandbox: Record<string, unknown> = {
      // Expose context data (read-only copies)
      current: context.current ? { ...context.current } : {},
      previous: context.previous ? { ...context.previous } : undefined,
      input: context.input ? { ...context.input } : {},
      variables: context.variables ? { ...context.variables } : {},
      user: context.user ? { ...context.user } : undefined,
      changedFields: context.changedFields ? [...context.changedFields] : [],

      // Safe logging
      console: {
        log: (...args: unknown[]) => {
          logs.push(args.map(String).join(' '));
        },
        warn: (...args: unknown[]) => {
          logs.push(`[WARN] ${args.map(String).join(' ')}`);
        },
        error: (...args: unknown[]) => {
          logs.push(`[ERROR] ${args.map(String).join(' ')}`);
        },
        info: (...args: unknown[]) => {
          logs.push(`[INFO] ${args.map(String).join(' ')}`);
        },
      },

      // Safe utilities
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify,
      },

      // Date utilities
      Date: {
        now: Date.now,
        parse: Date.parse,
        UTC: Date.UTC,
      },
      now: () => new Date(),

      // Math utilities
      Math: {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        random: Math.random,
        round: Math.round,
        sqrt: Math.sqrt,
        trunc: Math.trunc,
      },

      // String utilities
      String,
      Number,
      Boolean,
      Array,
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        fromEntries: Object.fromEntries,
      },

      // Promise support
      Promise,

      // Type checking
      typeof: (value: unknown) => typeof value,
      isArray: Array.isArray,
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      parseInt,
      parseFloat,

      // Helper functions for business logic
      helpers: this.buildHelpers(context),
    };

    // Add conditional APIs based on config
    if (config.allowHttpCalls) {
      sandbox['http'] = this.buildHttpClient();
    }

    if (config.allowDbQueries) {
      sandbox['db'] = this.buildDbClient();
    }

    return sandbox;
  }

  /**
   * Build helper functions for common business logic patterns
   */
  private buildHelpers(context: SandboxContext): Record<string, unknown> {
    return {
      // Field helpers
      getValue: (field: string) => {
        return context.current?.[field];
      },

      getPreviousValue: (field: string) => {
        return context.previous?.[field];
      },

      hasChanged: (field: string) => {
        if (!context.previous) return true;
        return context.current?.[field] !== context.previous?.[field];
      },

      changedTo: (field: string, value: unknown) => {
        if (!context.previous) return context.current?.[field] === value;
        return context.previous?.[field] !== value && context.current?.[field] === value;
      },

      changedFrom: (field: string, value: unknown) => {
        if (!context.previous) return false;
        return context.previous?.[field] === value && context.current?.[field] !== value;
      },

      // Date helpers
      daysBetween: (date1: Date | string, date2: Date | string) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },

      addDays: (date: Date | string, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      },

      addHours: (date: Date | string, hours: number) => {
        const result = new Date(date);
        result.setTime(result.getTime() + hours * 60 * 60 * 1000);
        return result;
      },

      // String helpers
      isEmpty: (value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        return false;
      },

      isNotEmpty: (value: unknown) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        return true;
      },

      // Validation helpers
      isEmail: (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },

      isPhone: (value: string) => {
        return /^\+?[\d\s-()]{10,}$/.test(value);
      },

      matches: (value: string, pattern: string) => {
        return new RegExp(pattern).test(value);
      },

      // Control flow helpers
      abort: (message: string) => {
        throw new Error(`ABORT: ${message}`);
      },

      // Result helpers
      setValue: (field: string, value: unknown) => {
        return { __action: 'setValue', field, value };
      },

      setValues: (values: Record<string, unknown>) => {
        return { __action: 'setValues', values };
      },
    };
  }

  /**
   * Build a restricted HTTP client
   */
  private buildHttpClient(): Record<string, unknown> {
    return {
      // Placeholder - actual implementation would use fetch with restrictions
      get: async (_url: string) => {
        throw new Error('HTTP calls require explicit permission');
      },
      post: async (_url: string, _body: unknown) => {
        throw new Error('HTTP calls require explicit permission');
      },
    };
  }

  /**
   * Build a restricted database client
   */
  private buildDbClient(): Record<string, unknown> {
    return {
      // Placeholder - actual implementation would provide read-only access
      query: async (_table: string, _filter: unknown) => {
        throw new Error('Database queries require explicit permission');
      },
      lookup: async (_table: string, _id: string) => {
        throw new Error('Database queries require explicit permission');
      },
    };
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeError(error: Error): string {
    const message = error.message || 'Unknown error';

    // Remove file paths and internal details
    return message
      .replace(/at\s+.*\(.*\)/g, '')
      .replace(/\n\s+at\s+.*/g, '')
      .replace(/\/[\w/.-]+/g, '[path]')
      .trim();
  }
}

/**
 * Expression evaluator for declarative conditions
 */
@Injectable()
export class ExpressionEvaluatorService {
  /**
   * Evaluate a JSON-based condition expression
   */
  evaluate(
    expression: ConditionExpression,
    record: Record<string, unknown>,
    previousRecord?: Record<string, unknown>
  ): boolean {
    if (!expression) return true;

    // Handle nested boolean expressions
    if (expression.conditions && expression.conditions.length > 0) {
      const results = expression.conditions.map((c) =>
        this.evaluate(c, record, previousRecord)
      );

      switch (expression.operator) {
        case 'and':
          return results.every((r) => r);
        case 'or':
          return results.some((r) => r);
        case 'not':
          return !results[0];
        default:
          return false;
      }
    }

    // Leaf condition - field comparison
    if (!expression.field || !expression.comparison) return true;

    const fieldValue = record[expression.field];
    const previousValue = previousRecord?.[expression.field];

    return this.compare(expression.comparison, fieldValue, expression.value, previousValue);
  }

  private compare(
    comparison: string,
    fieldValue: unknown,
    compareValue: unknown,
    previousValue?: unknown
  ): boolean {
    switch (comparison) {
      case 'eq':
        return fieldValue === compareValue;
      case 'ne':
        return fieldValue !== compareValue;
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case 'nin':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(compareValue).toLowerCase());
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(compareValue).toLowerCase());
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'changed':
        return fieldValue !== previousValue;
      case 'changed_to':
        return previousValue !== compareValue && fieldValue === compareValue;
      case 'changed_from':
        return previousValue === compareValue && fieldValue !== compareValue;
      case 'regex':
        return new RegExp(String(compareValue)).test(String(fieldValue));
      case 'between':
        if (!Array.isArray(compareValue) || compareValue.length !== 2) return false;
        const num = Number(fieldValue);
        return num >= Number(compareValue[0]) && num <= Number(compareValue[1]);
      default:
        return false;
    }
  }
}

// Re-export the condition expression type
interface ConditionExpression {
  operator: 'and' | 'or' | 'not';
  conditions?: ConditionExpression[];
  field?: string;
  comparison?: string;
  value?: unknown;
}
