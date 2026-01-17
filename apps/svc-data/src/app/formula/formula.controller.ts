/**
 * FormulaController
 * HubbleWave Platform - Phase 2
 *
 * REST API endpoints for formula operations.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { FormulaService } from './formula.service';
import { RollupService } from './rollup.service';
import { LookupService } from './lookup.service';
import { DependencyService } from './dependency.service';

interface EvaluateFormulaDto {
  formula: string;
  record: Record<string, unknown>;
  properties?: Array<{
    code: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
}

interface ValidateFormulaDto {
  formula: string;
  properties: Array<{
    code: string;
    name: string;
    type: string;
  }>;
}

interface CalculateRollupDto {
  relationProperty: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
  aggregateProperty: string;
  sourceCollection: string;
}

interface ResolveLookupDto {
  referenceProperty: string;
  referenceValue: unknown;
  sourceProperty: string;
  sourceCollection: string;
}

@Controller('formulas')
@UseGuards(JwtAuthGuard)
export class FormulaController {
  constructor(
    private readonly formulaService: FormulaService,
    private readonly rollupService: RollupService,
    private readonly lookupService: LookupService,
    private readonly dependencyService: DependencyService
  ) {}

  /**
   * Evaluate a formula for a specific record
   */
  @Post(':collectionCode/:recordId/evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluateFormula(
    @Param('collectionCode') collectionCode: string,
    @Param('recordId') recordId: string,
    @Body() dto: EvaluateFormulaDto
  ) {
    if (!dto.formula) {
      throw new BadRequestException('Formula is required');
    }

    const result = await this.formulaService.evaluateFormula(dto.formula, {
      collectionCode,
      recordId,
      record: dto.record,
      properties: dto.properties || [],
    });

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return { value: result.value };
  }

  /**
   * Validate a formula syntax
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateFormula(@Body() dto: ValidateFormulaDto) {
    if (!dto.formula) {
      throw new BadRequestException('Formula is required');
    }

    const result = this.formulaService.validateFormula(dto.formula, {
      collectionCode: 'validation',
      recordId: 'validation',
      record: {},
      properties: dto.properties,
    });

    return {
      valid: result.valid,
      errors: result.errors,
      dependencies: result.dependencies,
    };
  }

  /**
   * Get available formula functions
   */
  @Get('functions')
  async getAvailableFunctions() {
    return {
      functions: this.formulaService.getAvailableFunctions(),
    };
  }

  /**
   * Search for functions by query
   */
  @Get('functions/search')
  async searchFunctions(@Query('q') query: string) {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    return {
      functions: this.formulaService.searchFunctions(query),
    };
  }

  /**
   * Analyze formula dependencies
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeFormula(@Body() dto: { formula: string }) {
    if (!dto.formula) {
      throw new BadRequestException('Formula is required');
    }

    return this.formulaService.analyzeDependencies(dto.formula);
  }

  /**
   * Calculate a rollup value
   */
  @Post(':collectionCode/:recordId/rollup')
  @HttpCode(HttpStatus.OK)
  async calculateRollup(
    @Param('collectionCode') collectionCode: string,
    @Param('recordId') recordId: string,
    @Body() dto: CalculateRollupDto
  ) {
    if (!dto.relationProperty || !dto.aggregation || !dto.aggregateProperty) {
      throw new BadRequestException('Missing required rollup configuration');
    }

    const result = await this.rollupService.calculateRollup(
      collectionCode,
      recordId,
      {
        relationProperty: dto.relationProperty,
        aggregation: dto.aggregation,
        aggregateProperty: dto.aggregateProperty,
        sourceCollection: dto.sourceCollection,
      }
    );

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      value: result.value,
      count: result.count,
    };
  }

  /**
   * Resolve a lookup value
   */
  @Post(':collectionCode/:recordId/lookup')
  @HttpCode(HttpStatus.OK)
  async resolveLookup(
    @Param('collectionCode') collectionCode: string,
    @Param('recordId') recordId: string,
    @Body() dto: ResolveLookupDto
  ) {
    if (!dto.referenceProperty || !dto.sourceProperty) {
      throw new BadRequestException('Missing required lookup configuration');
    }

    const result = await this.lookupService.resolveLookup(
      collectionCode,
      recordId,
      dto.referenceValue,
      {
        referenceProperty: dto.referenceProperty,
        sourceProperty: dto.sourceProperty,
        sourceCollection: dto.sourceCollection,
      }
    );

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return { value: result.value };
  }

  /**
   * Invalidate cache for a record
   */
  @Post(':collectionCode/:recordId/invalidate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateCache(
    @Param('collectionCode') collectionCode: string,
    @Param('recordId') recordId: string
  ) {
    await this.formulaService.invalidateRecordCache(collectionCode, recordId);
  }

  /**
   * Register property dependencies
   */
  @Post(':collectionCode/:propertyCode/dependencies')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerDependencies(
    @Param('collectionCode') collectionCode: string,
    @Param('propertyCode') propertyCode: string,
    @Body()
    dto: {
      dependencies: Array<{
        targetCollection: string;
        targetProperty: string;
        dependencyType: 'formula' | 'rollup' | 'lookup';
      }>;
    }
  ) {
    await this.dependencyService.registerDependencies(
      collectionCode,
      propertyCode,
      dto.dependencies
    );
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  @Post('validate-dependency')
  @HttpCode(HttpStatus.OK)
  async validateDependency(
    @Body()
    dto: {
      sourceCollection: string;
      sourceProperty: string;
      targetCollection: string;
      targetProperty: string;
    }
  ) {
    const isValid = await this.dependencyService.validateNoCycle(
      dto.sourceCollection,
      dto.sourceProperty,
      dto.targetCollection,
      dto.targetProperty
    );

    return {
      valid: isValid,
      error: isValid ? null : 'Adding this dependency would create a circular reference',
    };
  }
}
