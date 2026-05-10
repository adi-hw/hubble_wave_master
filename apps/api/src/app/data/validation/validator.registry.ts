import { Injectable, Logger } from '@nestjs/common';
import {
  AnyValidationRule,
  ValidationContext,
  ValidationRuleResult,
} from './validation.types';

/**
 * Plan §6.2 — validator runtime registry.
 *
 * Each built-in validator (`regex`, `min`, `max`, `length`, `email`,
 * `url`, `uuid`, `customExpression`, plus the convenience aliases
 * `phone`, `range`, `required`, `min_length`, `max_length`) registers
 * a typed handler keyed by `rule.type`. `ValidationService.validateRule`
 * dispatches to the registry instead of carrying its own switch
 * statement, so a new validator only needs a registry entry — no
 * fan-out edits across the validation pipeline.
 *
 * Custom expression validators run inside `ValidationService`'s
 * NFKC-hardened expr-eval evaluator (denylist + length cap). The
 * canonical platform sandbox at apps/svc-automation
 * (`script-sandbox.service.ts`) is the long-term home for arbitrary
 * scripts; promoting it to a shared lib so this validator can
 * delegate is tracked as a cross-cutting follow-up. Authors can
 * extend the registry at module-init time via `register()`.
 */
/**
 * Validator handler. Accepts a value-rule pair plus the calling
 * context and returns a typed ValidationRuleResult. The rule
 * argument is widened to `unknown` here so authors can register
 * non-canonical type names (e.g. a customer-extension `tax_id`
 * validator) — the canonical built-ins still receive their typed
 * `AnyValidationRule` shapes via the registration site below.
 */
export type ValidatorHandler = (
  value: unknown,
  rule: AnyValidationRule | { type: string; [k: string]: unknown },
  propertyLabel: string,
  context: ValidationContext,
) => ValidationRuleResult | Promise<ValidationRuleResult>;

@Injectable()
export class ValidatorRegistry {
  private readonly logger = new Logger(ValidatorRegistry.name);
  private readonly handlers = new Map<string, ValidatorHandler>();

  register(type: string, handler: ValidatorHandler): void {
    if (this.handlers.has(type)) {
      this.logger.warn(`Validator "${type}" is being overridden`);
    }
    this.handlers.set(type, handler);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Returns the type names of every registered validator. Used by
   * the property-editor frontend to surface the canonical built-in set
   * + any registered extensions.
   */
  registeredTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async run(
    type: string,
    value: unknown,
    rule: AnyValidationRule | { type: string; [k: string]: unknown },
    propertyLabel: string,
    context: ValidationContext,
  ): Promise<ValidationRuleResult> {
    const handler = this.handlers.get(type);
    if (!handler) {
      this.logger.warn(`Unknown validator type: ${type}`);
      return { rule: type, passed: true };
    }
    return handler(value, rule, propertyLabel, context);
  }
}
