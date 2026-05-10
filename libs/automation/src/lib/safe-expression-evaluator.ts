/**
 * SafeExpressionEvaluator (F027 / W1 task 8).
 *
 * Hardened wrapper around `expr-eval` for evaluating user-authored
 * process-flow expressions (condition nodes, untilExpression on wait
 * steps, future surfaces). The bare `new Parser()` accepts identifiers
 * like `constructor.constructor('return process')()` which expr-eval
 * resolves through its IMEMBER token chain, giving the author a path
 * to escape the sandbox and access Node globals.
 *
 * This class layers five defenses, modelled on the existing pattern in
 * `apps/svc-automation/src/app/runtime/script-sandbox.service.ts`:
 *
 *   1. Length cap — bounds parse cost.
 *   2. NFKC normalization — folds homoglyph bypasses to canonical
 *      ASCII before pattern matching.
 *   3. Defanged copy for pattern checks — strips whitespace and string-
 *      literal contents so concatenation tricks like `'eva'+'l'` match
 *      the eval pattern. The original (normalized) script is what
 *      reaches the parser; defanging is a check-only artifact.
 *   4. AST depth cap — walks the expr-eval RPN token tree; rejects
 *      deeply-nested expressions that could exhaust the stack.
 *   5. Wall-clock timeout via Promise.race — expr-eval is synchronous
 *      so this is best-effort (the parser cannot be killed mid-run),
 *      but it bounds the response time.
 *
 * The deny list is duplicated here from script-sandbox.service.ts.
 * W7 owns consolidation into a single libs/safe-expr/ — until then,
 * any addition must be made in BOTH places. A scanner test confirming
 * the two lists stay in sync would be the ratchet.
 */

import { Parser } from 'expr-eval';

const MAX_EXPRESSION_LENGTH = 10_000;
const DEFAULT_AST_DEPTH = 64;
const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 5_000;

const BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
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

export class SafeExpressionError extends Error {
  constructor(message: string, public readonly reason: 'length' | 'pattern' | 'depth' | 'timeout' | 'parse') {
    super(`SafeExpression rejected: ${message} [${reason}]`);
    this.name = 'SafeExpressionError';
  }
}

export interface SafeExpressionOptions {
  /** Wall-clock timeout in ms; clamped to MAX_TIMEOUT_MS. Default 1000. */
  timeoutMs?: number;
  /** Override AST depth limit (default 64; clamped to a hard ceiling of 256). */
  maxAstDepth?: number;
}

interface ExprToken {
  type: string;
  value: unknown;
}

interface ParsedExpression {
  tokens: ExprToken[];
  evaluate: (scope: Record<string, unknown>) => unknown;
}

/**
 * Validate an expression string against the deny list and length cap.
 * Returns the NFKC-normalized form ready for parsing. Throws
 * SafeExpressionError on rejection.
 */
export function validateExpression(expression: string): string {
  if (typeof expression !== 'string') {
    throw new SafeExpressionError('expression must be a string', 'parse');
  }
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new SafeExpressionError(
      `expression length ${expression.length} exceeds ${MAX_EXPRESSION_LENGTH}`,
      'length',
    );
  }
  const normalised = expression.normalize('NFKC');
  const defanged = normalised
    .replace(/'(?:\\'|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""')
    .replace(/`(?:\\`|[^`])*`/g, '``')
    .replace(/\s+/g, '');

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalised) || pattern.test(defanged)) {
      throw new SafeExpressionError(
        `blocked pattern ${pattern.source}`,
        'pattern',
      );
    }
  }
  // NOTE: script-sandbox.service.ts also blocks `< >` characters
  // because its output may be inserted into HTML. SafeExpressionEvaluator
  // is for CONDITION expressions (Boolean output) and process-flow
  // wait/until expressions — comparison operators `<` `>` `<=` `>=`
  // are FIRST-CLASS and necessary. The deny-list patterns above
  // already block the dangerous identifier-shaped uses (`new`, `eval`,
  // etc.); leaving comparison operators free is correct here.
  return normalised;
}

function walkAstDepth(tokens: unknown, depth: number): number {
  if (!Array.isArray(tokens)) return depth;
  let maxDepth = depth;
  for (const token of tokens) {
    if (
      token &&
      typeof token === 'object' &&
      'value' in (token as Record<string, unknown>) &&
      Array.isArray((token as { value: unknown }).value)
    ) {
      const nested = walkAstDepth((token as { value: unknown[] }).value, depth + 1);
      if (nested > maxDepth) maxDepth = nested;
    }
  }
  return maxDepth;
}

export class SafeExpressionEvaluator {
  private readonly parser: Parser;

  constructor() {
    this.parser = new Parser({
      operators: {
        in: false,
        assignment: false,
      },
    });
  }

  /**
   * Validate, parse, and evaluate `expression` against `scope`. Returns
   * the evaluation result (any expr-eval-produced value). Throws
   * SafeExpressionError on rejection at any stage.
   */
  async evaluate(
    expression: string,
    scope: Record<string, unknown>,
    options: SafeExpressionOptions = {},
  ): Promise<unknown> {
    const normalised = validateExpression(expression);

    let parsed: ParsedExpression;
    try {
      // The expr-eval Expression type doesn't expose `tokens` in its
      // public types, but the runtime object has it. Convert through
      // `unknown` to satisfy TypeScript without losing the runtime
      // shape.
      parsed = this.parser.parse(normalised) as unknown as ParsedExpression;
    } catch (e) {
      throw new SafeExpressionError(
        `parse failed: ${(e as Error).message}`,
        'parse',
      );
    }

    const depthLimit = Math.min(
      options.maxAstDepth ?? DEFAULT_AST_DEPTH,
      256,
    );
    const depth = walkAstDepth(parsed.tokens, 1);
    if (depth > depthLimit) {
      throw new SafeExpressionError(
        `AST depth ${depth} exceeds ${depthLimit}`,
        'depth',
      );
    }

    const timeoutMs = Math.min(
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );

    return this.withTimeout(() => parsed.evaluate(scope), timeoutMs);
  }

  /**
   * Synchronous evaluate variant for callers that need a Boolean result
   * inline (e.g., condition-node fast path). Skips the wall-clock
   * timeout — caller MUST trust the input has been validated and the
   * AST cap is sufficient. Use evaluate() if input is user-supplied.
   */
  evaluateSync(expression: string, scope: Record<string, unknown>): unknown {
    const normalised = validateExpression(expression);
    let parsed: ParsedExpression;
    try {
      // The expr-eval Expression type doesn't expose `tokens` in its
      // public types, but the runtime object has it. Convert through
      // `unknown` to satisfy TypeScript without losing the runtime
      // shape.
      parsed = this.parser.parse(normalised) as unknown as ParsedExpression;
    } catch (e) {
      throw new SafeExpressionError(
        `parse failed: ${(e as Error).message}`,
        'parse',
      );
    }
    const depth = walkAstDepth(parsed.tokens, 1);
    if (depth > DEFAULT_AST_DEPTH) {
      throw new SafeExpressionError(
        `AST depth ${depth} exceeds ${DEFAULT_AST_DEPTH}`,
        'depth',
      );
    }
    return parsed.evaluate(scope);
  }

  private withTimeout<T>(work: () => T, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new SafeExpressionError(`evaluation exceeded ${timeoutMs}ms`, 'timeout'));
      }, timeoutMs);
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
}
