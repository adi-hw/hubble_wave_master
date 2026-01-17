/**
 * FormulaService
 * HubbleWave Platform - Phase 2
 *
 * Main service for formula evaluation and computed property resolution.
 * Integrates with the FormulaEngine from @hubblewave/formula-parser.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FormulaEngine,
  FormulaContext as EngineContext,
  RecordData,
} from '@hubblewave/formula-parser';
import { FormulaCacheService } from './formula-cache.service';
import { DependencyService } from './dependency.service';

interface CollectionMetadata {
  code: string;
  name: string;
  properties: PropertyMetadata[];
}

interface PropertyMetadata {
  code: string;
  name: string;
  propertyTypeCode: string;
  isRequired: boolean;
  typeConfig?: Record<string, unknown>;
}

interface FormulaContext {
  collectionCode: string;
  recordId: string;
  record: Record<string, unknown>;
  properties: PropertyDefinition[];
  currentUser?: {
    id: string;
    username?: string;
    roles?: string[];
  };
}

interface PropertyDefinition {
  code: string;
  name: string;
  type: string;
  propertyTypeCode?: string;
  config?: {
    formula?: string;
    rollupConfig?: RollupConfig;
    lookupConfig?: LookupConfig;
  };
  isRequired?: boolean;
}

interface RollupConfig {
  relationProperty: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
  aggregateProperty: string;
}

interface LookupConfig {
  referenceProperty: string;
  sourceProperty: string;
}

interface EvaluationResult {
  success: boolean;
  value?: unknown;
  error?: string;
  metrics?: {
    parseTime: number;
    evaluateTime: number;
    totalTime: number;
  };
}

@Injectable()
export class FormulaService implements OnModuleInit {
  private readonly logger = new Logger(FormulaService.name);
  private engine!: FormulaEngine;

  constructor(
    private readonly cacheService: FormulaCacheService,
    private readonly dependencyService: DependencyService
  ) {}

  onModuleInit(): void {
    this.engine = new FormulaEngine({
      cacheAST: true,
      maxCacheSize: 1000,
      validateBeforeEval: false,
    });
    this.logger.log('FormulaEngine initialized');
  }

  /**
   * Evaluate a formula for a specific record
   */
  async evaluateFormula(
    formula: string,
    context: FormulaContext
  ): Promise<EvaluationResult> {
    try {
      // Check cache first
      const cacheKey = this.cacheService.generateCacheKey(
        context.collectionCode,
        context.recordId,
        formula
      );
      const cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return { success: true, value: cached };
      }

      // Convert context to engine format
      const engineContext = this.buildEngineContext(context);

      // Evaluate using FormulaEngine
      const result = this.engine.evaluate(formula, engineContext);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          metrics: {
            parseTime: result.metrics.parseTime,
            evaluateTime: result.metrics.evaluateTime,
            totalTime: result.metrics.totalTime,
          },
        };
      }

      // Cache the result
      await this.cacheService.set(cacheKey, result.value);

      return {
        success: true,
        value: result.value,
        metrics: {
          parseTime: result.metrics.parseTime,
          evaluateTime: result.metrics.evaluateTime,
          totalTime: result.metrics.totalTime,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Formula evaluation failed: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  /**
   * Build engine context from service context
   */
  private buildEngineContext(context: FormulaContext): Partial<EngineContext> {
    const record = context.record as RecordData;

    const collectionMetadata: CollectionMetadata = {
      code: context.collectionCode,
      name: context.collectionCode,
      properties: context.properties.map((p) => this.toPropertyMetadata(p)),
    };

    return {
      record,
      collections: {
        [context.collectionCode]: collectionMetadata,
      },
      currentUser: context.currentUser
        ? {
            id: context.currentUser.id,
            username: context.currentUser.username,
            roles: context.currentUser.roles,
          }
        : undefined,
      now: new Date(),
    };
  }

  /**
   * Convert PropertyDefinition to PropertyMetadata
   */
  private toPropertyMetadata(prop: PropertyDefinition): PropertyMetadata {
    return {
      code: prop.code,
      name: prop.name,
      propertyTypeCode: prop.propertyTypeCode || prop.type,
      isRequired: prop.isRequired ?? false,
      typeConfig: prop.config,
    };
  }

  /**
   * Validate a formula syntax and dependencies
   */
  validateFormula(
    formula: string,
    context: FormulaContext
  ): { valid: boolean; errors: string[]; dependencies: string[] } {
    const collectionMetadata: Record<string, CollectionMetadata> = {
      [context.collectionCode]: {
        code: context.collectionCode,
        name: context.collectionCode,
        properties: context.properties.map((p) => this.toPropertyMetadata(p)),
      },
    };

    const validation = this.engine.validate(
      formula,
      collectionMetadata,
      context.collectionCode
    );

    return {
      valid: validation.valid,
      errors: validation.errors.map((e) => e.message),
      dependencies: [
        ...validation.dependencies.properties,
        ...validation.dependencies.relatedCollections,
      ],
    };
  }

  /**
   * Analyze dependencies in a formula
   */
  analyzeDependencies(formula: string): {
    properties: string[];
    functions: string[];
    relatedCollections: string[];
  } {
    const analysis = this.engine.analyzeDependencies(formula);
    return {
      properties: analysis.properties,
      functions: analysis.functions,
      relatedCollections: analysis.relatedCollections,
    };
  }

  /**
   * Get available formula functions
   */
  getAvailableFunctions(): Array<{
    name: string;
    category: string;
    description: string;
    syntax: string;
  }> {
    const functions = this.engine.getFunctions();
    return functions.map((f) => ({
      name: f.name,
      category: f.category,
      description: f.description,
      syntax: `${f.name}(${f.args.map((a) => a.name).join(', ')})`,
    }));
  }

  /**
   * Search for functions by name or description
   */
  searchFunctions(query: string): Array<{
    name: string;
    category: string;
    description: string;
  }> {
    const results = this.engine.searchFunctions(query);
    return results.map((f) => ({
      name: f.name,
      category: f.category,
      description: f.description,
    }));
  }

  /**
   * Evaluate all computed properties for a record
   */
  async evaluateComputedProperties(
    context: FormulaContext
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    // Get properties in dependency order
    const orderedProps = await this.dependencyService.getEvaluationOrder(
      context.collectionCode,
      context.properties
    );

    for (const prop of orderedProps) {
      if (prop.type === 'formula' && prop.config?.formula) {
        const result = await this.evaluateFormula(prop.config.formula, {
          ...context,
          record: { ...context.record, ...results },
        });
        if (result.success) {
          results[prop.code] = result.value;
        }
      }
    }

    return results;
  }

  /**
   * Invalidate cache for a record when data changes
   */
  async invalidateRecordCache(
    collectionCode: string,
    recordId: string
  ): Promise<void> {
    await this.cacheService.invalidateRecord(collectionCode, recordId);

    // Find dependent records and invalidate them too
    const dependents = await this.dependencyService.getDependentRecords(
      collectionCode,
      recordId
    );

    for (const dep of dependents) {
      await this.cacheService.invalidateRecord(dep.collectionCode, dep.recordId);
    }
  }
}
