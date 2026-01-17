/**
 * Formula Engine
 *
 * The main entry point for formula parsing, validation, and evaluation.
 */

import { Parser, ASTNode } from './parser';
import { Evaluator } from './evaluator';
import { FormulaValidator, ValidationResult } from './validator';
import { FunctionRegistry } from './function-registry';
import { FormulaContext, CollectionMetadata, createEmptyContext } from './context';
import { FormulaValue, FormulaMetrics, DependencyAnalysis } from './types';
import { getAllBuiltinFunctions } from './functions';

/**
 * Formula engine options
 */
export interface FormulaEngineOptions {
  /** Whether to cache parsed ASTs */
  cacheAST?: boolean;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Whether to validate formulas before evaluation */
  validateBeforeEval?: boolean;
  /** Collection metadata for validation */
  collections?: Record<string, CollectionMetadata>;
  /** Current collection for property validation */
  currentCollection?: string;
}

/**
 * Complete formula evaluation result
 */
export interface FormulaResult {
  value: FormulaValue;
  success: boolean;
  error?: string;
  validation?: ValidationResult;
  metrics: FormulaMetrics;
}

/**
 * AST cache entry
 */
interface ASTCacheEntry {
  ast: ASTNode;
  timestamp: number;
}

/**
 * Main formula engine class
 */
export class FormulaEngine {
  private parser: Parser;
  private evaluator: Evaluator;
  private validator: FormulaValidator;
  private functionRegistry: FunctionRegistry;
  private options: FormulaEngineOptions;
  private astCache: Map<string, ASTCacheEntry>;

  constructor(options: FormulaEngineOptions = {}) {
    this.options = {
      cacheAST: true,
      maxCacheSize: 1000,
      validateBeforeEval: false,
      ...options,
    };

    this.functionRegistry = new FunctionRegistry();
    this.functionRegistry.registerAll(getAllBuiltinFunctions());

    this.parser = new Parser();
    this.evaluator = new Evaluator(this.functionRegistry);
    this.validator = new FormulaValidator(this.functionRegistry);
    this.astCache = new Map();
  }

  /**
   * Parse a formula into an AST
   */
  parse(formula: string): ASTNode {
    const cached = this.astCache.get(formula);
    if (cached) {
      return cached.ast;
    }

    const ast = this.parser.parse(formula);

    if (this.options.cacheAST) {
      this.cacheAST(formula, ast);
    }

    return ast;
  }

  /**
   * Validate a formula
   */
  validate(
    formula: string,
    collections?: Record<string, CollectionMetadata>,
    currentCollection?: string
  ): ValidationResult {
    const ast = this.parse(formula);
    return this.validator.validate(
      ast,
      collections ?? this.options.collections ?? {},
      currentCollection ?? this.options.currentCollection ?? ''
    );
  }

  /**
   * Evaluate a formula against a context
   */
  evaluate(formula: string, context?: Partial<FormulaContext>): FormulaResult {
    const startTime = performance.now();

    try {
      const ast = this.parse(formula);
      const parseTime = performance.now() - startTime;

      // Validate if configured
      let validation: ValidationResult | undefined;
      if (this.options.validateBeforeEval) {
        validation = this.validator.validate(
          ast,
          this.options.collections ?? {},
          this.options.currentCollection ?? ''
        );

        if (!validation.valid) {
          return {
            value: null,
            success: false,
            error: validation.errors[0]?.message,
            validation,
            metrics: {
              parseTime,
              evaluateTime: 0,
              totalTime: performance.now() - startTime,
              propertyAccesses: 0,
              relatedLookups: 0,
              functionCalls: 0,
              fromCache: false,
            },
          };
        }
      }

      const fullContext: FormulaContext = {
        ...createEmptyContext(),
        ...context,
      };

      const result = this.evaluator.evaluate(ast, fullContext);

      return {
        value: result.value,
        success: result.success,
        error: result.error,
        validation,
        metrics: {
          ...result.metrics,
          parseTime,
          totalTime: performance.now() - startTime,
        },
      };
    } catch (error) {
      return {
        value: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          parseTime: 0,
          evaluateTime: 0,
          totalTime: performance.now() - startTime,
          propertyAccesses: 0,
          relatedLookups: 0,
          functionCalls: 0,
          fromCache: false,
        },
      };
    }
  }

  /**
   * Analyze dependencies in a formula
   */
  analyzeDependencies(formula: string): DependencyAnalysis {
    const validation = this.validate(formula);
    return validation.dependencies;
  }

  /**
   * Get inferred return type of a formula
   */
  inferType(formula: string): string | undefined {
    const validation = this.validate(formula);
    return validation.inferredType;
  }

  /**
   * Register a custom function
   */
  registerFunction(func: Parameters<FunctionRegistry['register']>[0]): void {
    this.functionRegistry.register(func);
  }

  /**
   * Get all available functions
   */
  getFunctions(): ReturnType<FunctionRegistry['list']> {
    return this.functionRegistry.list();
  }

  /**
   * Search functions by name or description
   */
  searchFunctions(query: string): ReturnType<FunctionRegistry['search']> {
    return this.functionRegistry.search(query);
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: string): ReturnType<FunctionRegistry['listByCategory']> {
    return this.functionRegistry.listByCategory(category as Parameters<FunctionRegistry['listByCategory']>[0]);
  }

  /**
   * Clear the AST cache
   */
  clearCache(): void {
    this.astCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.astCache.size,
      maxSize: this.options.maxCacheSize ?? 1000,
    };
  }

  /**
   * Set collection metadata for validation
   */
  setCollections(collections: Record<string, CollectionMetadata>, currentCollection?: string): void {
    this.options.collections = collections;
    if (currentCollection) {
      this.options.currentCollection = currentCollection;
    }
  }

  private cacheAST(formula: string, ast: ASTNode): void {
    // Evict oldest entries if cache is full
    if (this.astCache.size >= (this.options.maxCacheSize ?? 1000)) {
      const oldest = Array.from(this.astCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.astCache.size / 4));

      for (const [key] of oldest) {
        this.astCache.delete(key);
      }
    }

    this.astCache.set(formula, {
      ast,
      timestamp: Date.now(),
    });
  }
}

/**
 * Create a formula engine with default settings
 */
export function createFormulaEngine(options?: FormulaEngineOptions): FormulaEngine {
  return new FormulaEngine(options);
}
