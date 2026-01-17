/**
 * AVA Schema Controller - Phase 2
 *
 * Provides API endpoints for AVA-assisted schema design,
 * formula creation, view configuration, and impact assessment.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import {
  AVASchemaService,
  DesignCollectionDto,
  RecommendPropertiesDto,
  CreateFormulaDto,
  DebugFormulaDto,
  OptimizeFormulaDto,
  DesignViewDto,
  AssessImpactDto,
} from '@hubblewave/ai';

interface SchemaQueryDto {
  query: string;
  collectionId?: string;
}

interface ExplainPropertyDto {
  collectionId: string;
  propertyName: string;
}

interface MigrationRequestDto {
  source: 'servicenow' | 'salesforce' | 'excel' | 'csv' | 'custom';
  collections?: string[];
  sampleData?: Record<string, unknown>[];
}

@ApiTags('AVA - Schema Assistance')
@ApiBearerAuth()
@Controller('api/ava/schema')
@UseGuards(JwtAuthGuard)
export class AVASchemaController {
  constructor(private readonly avaSchemaService: AVASchemaService) {}

  @Post('design-collection')
  @ApiOperation({ summary: 'Get AVA help designing a collection' })
  @ApiResponse({ status: 200, description: 'Collection schema recommendation' })
  async designCollection(
    @CurrentUser() _user: RequestUser,
    @Body() dto: DesignCollectionDto
  ) {
    const recommendation = await this.avaSchemaService.designCollection(dto);
    return {
      success: true,
      recommendation,
    };
  }

  @Post('recommend-properties')
  @ApiOperation({ summary: 'Get property recommendations for a use case' })
  @ApiResponse({ status: 200, description: 'Property recommendations' })
  async recommendProperties(
    @CurrentUser() _user: RequestUser,
    @Body() dto: RecommendPropertiesDto
  ) {
    const properties = await this.avaSchemaService.recommendProperties(dto);
    return {
      success: true,
      properties,
      count: properties.length,
    };
  }

  @Post('create-formula')
  @ApiOperation({ summary: 'Generate formula from natural language description' })
  @ApiResponse({ status: 200, description: 'Generated formula with explanation' })
  async createFormula(
    @CurrentUser() _user: RequestUser,
    @Body() dto: CreateFormulaDto
  ) {
    const result = await this.avaSchemaService.createFormula(dto);
    return {
      success: true,
      formula: result.formula,
      explanation: result.explanation,
      resultType: result.resultType,
      dependencies: result.dependencies,
      cacheStrategy: result.cacheStrategy,
      cacheTtl: result.cacheTtl,
      examples: result.examples,
      alternatives: result.alternatives,
    };
  }

  @Post('debug-formula')
  @ApiOperation({ summary: 'Debug and fix formula issues' })
  @ApiResponse({ status: 200, description: 'Formula debug results with suggestions' })
  async debugFormula(
    @CurrentUser() _user: RequestUser,
    @Body() dto: DebugFormulaDto
  ) {
    const result = await this.avaSchemaService.debugFormula(dto);
    return {
      success: true,
      issues: result.issues,
      hasErrors: result.issues.length > 0,
      suggestion: result.suggestion,
      explanation: result.explanation,
    };
  }

  @Post('optimize-formula')
  @ApiOperation({ summary: 'Optimize formula for better performance' })
  @ApiResponse({ status: 200, description: 'Formula optimization recommendations' })
  async optimizeFormula(
    @CurrentUser() _user: RequestUser,
    @Body() dto: OptimizeFormulaDto
  ) {
    const result = await this.avaSchemaService.optimizeFormula(dto);
    return {
      success: true,
      currentPerformance: result.currentPerformance,
      bottlenecks: result.bottlenecks,
      optimizedApproach: result.optimizedApproach,
      recommendation: result.recommendation,
    };
  }

  @Post('design-view')
  @ApiOperation({ summary: 'Get view configuration recommendations' })
  @ApiResponse({ status: 200, description: 'View design recommendation' })
  async designView(
    @CurrentUser() _user: RequestUser,
    @Body() dto: DesignViewDto
  ) {
    const recommendation = await this.avaSchemaService.designView(dto);
    return {
      success: true,
      recommendation,
    };
  }

  @Post('assess-impact')
  @ApiOperation({ summary: 'Assess schema change impact' })
  @ApiResponse({ status: 200, description: 'Impact assessment with breaking changes and migration strategy' })
  async assessImpact(
    @CurrentUser() _user: RequestUser,
    @Body() dto: AssessImpactDto
  ) {
    const assessment = await this.avaSchemaService.assessImpact(dto);
    return {
      success: true,
      assessment,
      hasBreakingChanges: assessment.breakingChanges,
      hasDataLoss: assessment.dataLoss,
    };
  }

  @Post('suggest-migration')
  @ApiOperation({ summary: 'Get migration guidance from external system' })
  @ApiResponse({ status: 200, description: 'Migration plan and recommendations' })
  async suggestMigration(
    @CurrentUser() _user: RequestUser,
    @Body() dto: MigrationRequestDto
  ) {
    // Generate migration guidance based on source system
    const phases = this.generateMigrationPhases(dto.source);

    return {
      success: true,
      source: dto.source,
      phases,
      estimatedEffort: this.estimateEffort(dto.source, dto.collections?.length || 0),
      avaAssistance: [
        'Auto-generate schemas from exports',
        'Validate data quality during migration',
        'Recommend optimal property types',
        'Create formulas from business rules',
      ],
    };
  }

  @Post('query-schema')
  @ApiOperation({ summary: 'Answer natural language questions about schema' })
  @ApiResponse({ status: 200, description: 'Schema query results' })
  async querySchema(
    @CurrentUser() _user: RequestUser,
    @Body() dto: SchemaQueryDto
  ) {
    const intent = this.avaSchemaService.matchIntent(dto.query);

    return {
      success: true,
      query: dto.query,
      intent: intent?.category,
      confidence: intent?.confidence || 0,
      entities: intent?.entities || {},
      response: intent
        ? `I understand you want to ${intent.category.replace(/_/g, ' ')}. Let me help you with that.`
        : 'I can help you with schema design, formula creation, view configuration, and more. Please be more specific about what you need.',
    };
  }

  @Post('explain-property')
  @ApiOperation({ summary: 'Get detailed explanation of a property configuration' })
  @ApiResponse({ status: 200, description: 'Property explanation' })
  async explainProperty(
    @CurrentUser() _user: RequestUser,
    @Body() dto: ExplainPropertyDto
  ) {
    return {
      success: true,
      collectionId: dto.collectionId,
      propertyName: dto.propertyName,
      explanation: `The ${dto.propertyName} property stores data and can be configured with various settings including validation, indexing, and display options.`,
      relatedProperties: [],
      usageHints: [
        'This property can be used in formulas',
        'You can filter views by this property',
        'Consider adding validation rules for data quality',
      ],
    };
  }

  private generateMigrationPhases(source: string) {
    const basePhases = [
      {
        phase: 1,
        name: 'Schema Analysis',
        tasks: [
          `Export ${source} table definitions`,
          'Map fields to HubbleWave properties',
          'Identify custom fields and business rules',
          'Document relationships and references',
        ],
        duration: '1-2 days',
      },
      {
        phase: 2,
        name: 'Schema Creation',
        tasks: [
          'Create HubbleWave collections',
          'Define properties with correct types',
          'Set up relationships',
          'Recreate business rules as formulas',
        ],
        duration: '2-3 days',
        avaAssistance: 'I can auto-generate schemas from exports',
      },
      {
        phase: 3,
        name: 'Data Migration',
        tasks: [
          `Export data from ${source}`,
          'Transform data to HubbleWave format',
          'Validate data quality',
          'Import in batches',
          'Verify record counts and relationships',
        ],
        duration: '3-5 days',
        avaAssistance: 'I can validate data quality and suggest transformations',
      },
      {
        phase: 4,
        name: 'View & Form Recreation',
        tasks: [
          'Recreate key list views',
          'Build form layouts',
          'Set up filters and views',
          'Configure dashboards',
        ],
        duration: '2-3 days',
        avaAssistance: 'I can recommend optimal view configurations',
      },
      {
        phase: 5,
        name: 'Testing & Validation',
        tasks: [
          'User acceptance testing',
          'Performance validation',
          'Security review',
          'Training materials',
        ],
        duration: '1 week',
      },
    ];

    return basePhases;
  }

  private estimateEffort(source: string, collectionCount: number): string {
    const baseWeeks = source === 'servicenow' ? 4 : source === 'salesforce' ? 3 : 2;
    const collectionMultiplier = Math.ceil(collectionCount / 10);
    const totalWeeks = baseWeeks + collectionMultiplier;
    return `${totalWeeks}-${totalWeeks + 2} weeks`;
  }
}
