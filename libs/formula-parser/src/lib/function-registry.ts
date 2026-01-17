/**
 * Function Registry
 *
 * Manages built-in and custom formula functions.
 */

import { FormulaValue, FormulaValueType } from './types';
import { FormulaContext } from './context';

/**
 * Function categories for organization
 */
export type FunctionCategory =
  | 'math'
  | 'text'
  | 'date'
  | 'logic'
  | 'reference'
  | 'aggregate'
  | 'utility'
  | 'custom';

/**
 * Function argument definition
 */
export interface FunctionArgument {
  name: string;
  type: FormulaValueType | FormulaValueType[];
  required?: boolean;
  description?: string;
  defaultValue?: FormulaValue;
}

/**
 * Formula function definition
 */
export interface FormulaFunction {
  name: string;
  category: FunctionCategory;
  description: string;
  args: FunctionArgument[];
  returnType: FormulaValueType;
  minArgs?: number;
  maxArgs?: number;
  implementation: (args: FormulaValue[], context: FormulaContext) => FormulaValue;
  examples?: string[];
}

/**
 * Function registry for managing formula functions
 */
export class FunctionRegistry {
  private functions: Map<string, FormulaFunction> = new Map();

  /**
   * Register a function
   */
  register(func: FormulaFunction): void {
    this.functions.set(func.name.toUpperCase(), func);
  }

  /**
   * Register multiple functions
   */
  registerAll(funcs: FormulaFunction[]): void {
    funcs.forEach((f) => this.register(f));
  }

  /**
   * Get a function by name
   */
  get(name: string): FormulaFunction | undefined {
    return this.functions.get(name.toUpperCase());
  }

  /**
   * Check if a function exists
   */
  has(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }

  /**
   * List all functions
   */
  list(): FormulaFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * List functions by category
   */
  listByCategory(category: FunctionCategory): FormulaFunction[] {
    return this.list().filter((f) => f.category === category);
  }

  /**
   * Search functions by name or description
   */
  search(query: string): FormulaFunction[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(
      (f) =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Execute a function
   */
  execute(name: string, args: FormulaValue[], context: FormulaContext): FormulaValue {
    const func = this.get(name);
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }
    return func.implementation(args, context);
  }
}

/**
 * Create a default function registry with all built-in functions
 */
export function createDefaultRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry();

  // Math functions will be registered separately
  // Text functions will be registered separately
  // Date functions will be registered separately
  // Logic functions will be registered separately
  // Reference functions will be registered separately
  // Aggregate functions will be registered separately

  return registry;
}
