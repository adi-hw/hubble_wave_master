/**
 * AVA Schema Assistance Service - Phase 2
 *
 * Provides AI-powered assistance for schema design, formula creation,
 * view configuration, and schema change impact assessment.
 */

import { Injectable } from '@nestjs/common';
import { LLMService } from './llm.service';
import {
  FormulaResult,
  SchemaRecommendation,
  PropertyRecommendation,
  ViewRecommendation,
  ImpactAssessment,
  RelationshipRecommendation,
  matchIntent,
} from './intents/phase2-intents';

export interface DesignCollectionDto {
  purpose: string;
  domain?: string;
  existingCollections?: string[];
}

export interface RecommendPropertiesDto {
  purpose: string;
  collectionId?: string;
  existingProperties?: string[];
}

export interface CreateFormulaDto {
  description: string;
  context: {
    collectionId?: string;
    availableProperties: Array<{ name: string; type: string }>;
    currentFormula?: string;
  };
}

export interface DebugFormulaDto {
  formula: string;
  error?: string;
  context?: {
    collectionId?: string;
    availableProperties: Array<{ name: string; type: string }>;
  };
}

export interface OptimizeFormulaDto {
  formula: string;
  currentPerformance?: {
    executionTime: number;
    recordsProcessed: number;
  };
  context?: {
    collectionId?: string;
    availableProperties: Array<{ name: string; type: string }>;
  };
}

export interface DesignViewDto {
  purpose: string;
  collectionId: string;
  preferredType?: string;
  availableProperties: Array<{ name: string; type: string }>;
}

export interface AssessImpactDto {
  collection: string;
  property: string;
  change: {
    from: string;
    to: string;
  };
}

export interface FormulaDebugResult {
  issues: Array<{
    type: 'syntax_error' | 'missing_parameter' | 'type_mismatch' | 'unknown_function' | 'unknown_property';
    message: string;
    position?: { line: number; column: number };
  }>;
  suggestion: string;
  explanation: string;
}

export interface FormulaOptimization {
  currentPerformance: {
    executionTime: number;
    recordsProcessed: number;
    cacheHitRate: number;
  };
  bottlenecks: Array<{
    issue: string;
    impact: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  optimizedApproach: {
    propertyType: string;
    config: Record<string, unknown>;
    expectedPerformance: {
      executionTime: number;
      improvement: string;
      cacheHitRate: number;
    };
  };
  recommendation: string;
}

const FORMULA_FUNCTIONS = [
  { name: 'IF', syntax: 'IF(condition, true_value, false_value)', description: 'Conditional logic' },
  { name: 'SWITCH', syntax: 'SWITCH(expression, case1, value1, ...)', description: 'Multi-case conditional' },
  { name: 'SUM', syntax: 'SUM(value1, value2, ...)', description: 'Sum numbers' },
  { name: 'AVG', syntax: 'AVG(value1, value2, ...)', description: 'Average of numbers' },
  { name: 'MIN', syntax: 'MIN(value1, value2, ...)', description: 'Minimum value' },
  { name: 'MAX', syntax: 'MAX(value1, value2, ...)', description: 'Maximum value' },
  { name: 'COUNT', syntax: 'COUNT(collection)', description: 'Count items' },
  { name: 'COUNTIF', syntax: 'COUNTIF(collection, condition)', description: 'Conditional count' },
  { name: 'DATEDIFF', syntax: 'DATEDIFF(date1, date2, unit)', description: 'Date difference' },
  { name: 'DATEADD', syntax: 'DATEADD(date, amount, unit)', description: 'Add to date' },
  { name: 'TODAY', syntax: 'TODAY()', description: 'Current date' },
  { name: 'NOW', syntax: 'NOW()', description: 'Current datetime' },
  { name: 'CONCAT', syntax: 'CONCAT(text1, text2, ...)', description: 'Join text' },
  { name: 'UPPER', syntax: 'UPPER(text)', description: 'Uppercase text' },
  { name: 'LOWER', syntax: 'LOWER(text)', description: 'Lowercase text' },
  { name: 'TRIM', syntax: 'TRIM(text)', description: 'Remove whitespace' },
  { name: 'ROUND', syntax: 'ROUND(number, decimals)', description: 'Round number' },
  { name: 'ABS', syntax: 'ABS(number)', description: 'Absolute value' },
  { name: 'LOOKUP', syntax: 'LOOKUP(reference, property)', description: 'Look up related value' },
];

const PROPERTY_TYPE_TEMPLATES: Record<string, PropertyRecommendation> = {
  email: {
    name: 'email',
    displayName: 'Email',
    type: 'text',
    typeConfig: { format: 'email', maxLength: 255 },
    required: false,
    indexed: true,
    description: 'Email address with validation',
    confidence: 0.9,
  },
  phone: {
    name: 'phone',
    displayName: 'Phone',
    type: 'text',
    typeConfig: { format: 'phone' },
    required: false,
    indexed: false,
    description: 'Phone number with formatting',
    confidence: 0.85,
  },
  status: {
    name: 'status',
    displayName: 'Status',
    type: 'choice',
    typeConfig: { choices: ['Active', 'Inactive', 'Pending'] },
    required: true,
    indexed: true,
    description: 'Record status',
    confidence: 0.9,
  },
  created_at: {
    name: 'created_at',
    displayName: 'Created At',
    type: 'datetime',
    typeConfig: { defaultValue: 'NOW()' },
    required: true,
    indexed: true,
    description: 'Record creation timestamp',
    confidence: 0.95,
  },
  updated_at: {
    name: 'updated_at',
    displayName: 'Updated At',
    type: 'datetime',
    typeConfig: { autoUpdate: true },
    required: true,
    indexed: true,
    description: 'Last update timestamp',
    confidence: 0.95,
  },
};

@Injectable()
export class AVASchemaService {
  constructor(private readonly llmService: LLMService) {
    // LLM service injected for future AI-powered enhancements
    void this.llmService;
  }

  /**
   * Design a collection based on natural language purpose description
   */
  async designCollection(dto: DesignCollectionDto): Promise<SchemaRecommendation> {
    const { purpose, domain } = dto;

    const properties = await this.inferPropertiesFromPurpose(purpose, domain);
    const relationships = this.inferRelationships(purpose, dto.existingCollections || []);

    const collectionName = this.generateCollectionName(purpose);

    return {
      name: collectionName.code,
      displayName: collectionName.display,
      description: `Collection for ${purpose}`,
      properties,
      relationships,
      explanation: `Based on your purpose "${purpose}", I recommend a collection with ${properties.length} properties. This structure supports typical ${domain || 'business'} operations.`,
    };
  }

  /**
   * Recommend properties for a use case
   */
  async recommendProperties(dto: RecommendPropertiesDto): Promise<PropertyRecommendation[]> {
    const { purpose } = dto;
    const properties: PropertyRecommendation[] = [];

    const purposeLower = purpose.toLowerCase();

    // Infer common properties based on purpose keywords
    if (purposeLower.includes('customer') || purposeLower.includes('contact')) {
      properties.push(
        { ...PROPERTY_TYPE_TEMPLATES['email'], name: 'email', displayName: 'Email' },
        { ...PROPERTY_TYPE_TEMPLATES['phone'], name: 'phone', displayName: 'Phone' },
        this.createPropertyRecommendation('name', 'Name', 'text', true, true),
        this.createPropertyRecommendation('company', 'Company', 'text', false, true),
      );
    }

    if (purposeLower.includes('order') || purposeLower.includes('purchase')) {
      properties.push(
        this.createPropertyRecommendation('order_number', 'Order Number', 'text', true, true, { unique: true }),
        this.createPropertyRecommendation('order_date', 'Order Date', 'datetime', true, true),
        this.createPropertyRecommendation('total_amount', 'Total Amount', 'currency', true, false),
        { ...PROPERTY_TYPE_TEMPLATES['status'], typeConfig: { choices: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] } },
      );
    }

    if (purposeLower.includes('task') || purposeLower.includes('work order') || purposeLower.includes('ticket')) {
      properties.push(
        this.createPropertyRecommendation('title', 'Title', 'text', true, true),
        this.createPropertyRecommendation('description', 'Description', 'rich_text', false, false),
        this.createPropertyRecommendation('priority', 'Priority', 'choice', true, true, { choices: ['Low', 'Medium', 'High', 'Critical'] }),
        { ...PROPERTY_TYPE_TEMPLATES['status'], typeConfig: { choices: ['New', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] } },
        this.createPropertyRecommendation('due_date', 'Due Date', 'date', false, true),
        this.createPropertyRecommendation('assigned_to', 'Assigned To', 'user', false, true),
      );
    }

    if (purposeLower.includes('asset') || purposeLower.includes('equipment') || purposeLower.includes('inventory')) {
      properties.push(
        this.createPropertyRecommendation('asset_tag', 'Asset Tag', 'text', true, true, { unique: true }),
        this.createPropertyRecommendation('name', 'Name', 'text', true, true),
        this.createPropertyRecommendation('category', 'Category', 'choice', true, true),
        this.createPropertyRecommendation('location', 'Location', 'reference', false, true),
        this.createPropertyRecommendation('serial_number', 'Serial Number', 'text', false, true),
        this.createPropertyRecommendation('purchase_date', 'Purchase Date', 'date', false, true),
        this.createPropertyRecommendation('purchase_cost', 'Purchase Cost', 'currency', false, false),
      );
    }

    // Always add standard fields
    properties.push(
      { ...PROPERTY_TYPE_TEMPLATES['created_at'] },
      { ...PROPERTY_TYPE_TEMPLATES['updated_at'] },
    );

    return properties;
  }

  /**
   * Generate formula from natural language description
   */
  async createFormula(dto: CreateFormulaDto): Promise<FormulaResult> {
    const { description, context } = dto;
    const descLower = description.toLowerCase();

    // Pattern matching for common formula types
    if (descLower.includes('age') && descLower.includes('days')) {
      return this.createDateDiffFormula('created_at', 'days', context.availableProperties);
    }

    if (descLower.includes('overdue') || (descLower.includes('past') && descLower.includes('due'))) {
      return this.createOverdueFormula(context.availableProperties);
    }

    if (descLower.includes('discount') && descLower.includes('amount')) {
      return this.createTieredDiscountFormula(context.availableProperties);
    }

    if (descLower.includes('priority') && descLower.includes('score')) {
      return this.createPriorityScoreFormula(context.availableProperties);
    }

    if (descLower.includes('concatenate') || descLower.includes('combine') || descLower.includes('full name')) {
      return this.createConcatFormula(context.availableProperties);
    }

    // Default to a basic formula with guidance
    return {
      formula: '/* Your formula here */',
      explanation: `To calculate "${description}", you can use these available properties: ${context.availableProperties.map(p => p.name).join(', ')}`,
      resultType: 'text',
      dependencies: [],
      cacheStrategy: 'on_save',
      examples: [],
      alternatives: [],
    };
  }

  /**
   * Debug a formula and suggest fixes
   */
  async debugFormula(dto: DebugFormulaDto): Promise<FormulaDebugResult> {
    const { formula, context } = dto;
    const issues: FormulaDebugResult['issues'] = [];

    // Check for common syntax issues
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push({
        type: 'syntax_error',
        message: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`,
      });
    }

    // Check for DATEDIFF without unit parameter
    if (formula.includes('DATEDIFF') && !formula.match(/DATEDIFF\s*\([^)]+,[^)]+,[^)]+\)/)) {
      issues.push({
        type: 'missing_parameter',
        message: 'DATEDIFF requires 3 parameters: date1, date2, and unit (e.g., "days")',
      });
    }

    // Check for unknown functions
    const knownFunctions = FORMULA_FUNCTIONS.map(f => f.name.toUpperCase());
    const functionCalls = formula.match(/([A-Z_]+)\s*\(/gi) || [];
    for (const call of functionCalls) {
      const funcName = call.replace(/\s*\(/, '').toUpperCase();
      if (!knownFunctions.includes(funcName)) {
        issues.push({
          type: 'unknown_function',
          message: `Unknown function: ${funcName}`,
        });
      }
    }

    // Check for unknown properties
    if (context?.availableProperties) {
      const propertyNames = context.availableProperties.map(p => p.name.toLowerCase());
      const usedIdentifiers = formula.match(/[a-z_][a-z0-9_]*/gi) || [];
      for (const identifier of usedIdentifiers) {
        if (!knownFunctions.includes(identifier.toUpperCase()) &&
            !propertyNames.includes(identifier.toLowerCase()) &&
            !['true', 'false', 'null', 'and', 'or', 'not'].includes(identifier.toLowerCase())) {
          issues.push({
            type: 'unknown_property',
            message: `Unknown property or identifier: ${identifier}`,
          });
        }
      }
    }

    // Generate suggestion
    let suggestion = formula;
    if (issues.some(i => i.type === 'missing_parameter' && i.message.includes('DATEDIFF'))) {
      suggestion = formula.replace(
        /DATEDIFF\s*\(([^,]+),\s*([^)]+)\)/gi,
        'DATEDIFF($1, $2, "days")'
      );
    }

    return {
      issues,
      suggestion,
      explanation: issues.length > 0
        ? `Found ${issues.length} issue(s) with the formula. ${issues[0].message}`
        : 'No issues found with the formula syntax.',
    };
  }

  /**
   * Optimize formula for better performance
   */
  async optimizeFormula(dto: OptimizeFormulaDto): Promise<FormulaOptimization> {
    const { formula, currentPerformance } = dto;

    const bottlenecks: FormulaOptimization['bottlenecks'] = [];

    // Check for COUNTIF that could be a rollup
    if (formula.includes('COUNTIF')) {
      bottlenecks.push({
        issue: 'COUNTIF recalculates on every access',
        impact: 'high',
        suggestion: 'Convert to a Rollup property for database-level aggregation',
      });
    }

    // Check for no caching
    if (!formula.includes('/*cached*/')) {
      bottlenecks.push({
        issue: 'No caching configured',
        impact: 'medium',
        suggestion: 'Add periodic caching to reduce recalculation frequency',
      });
    }

    // Check for nested lookups
    if ((formula.match(/LOOKUP/gi) || []).length > 1) {
      bottlenecks.push({
        issue: 'Multiple nested LOOKUP calls',
        impact: 'medium',
        suggestion: 'Consider denormalizing data or using a rollup instead',
      });
    }

    return {
      currentPerformance: {
        executionTime: currentPerformance?.executionTime || 0,
        recordsProcessed: currentPerformance?.recordsProcessed || 0,
        cacheHitRate: 0,
      },
      bottlenecks,
      optimizedApproach: {
        propertyType: bottlenecks.some(b => b.suggestion.includes('Rollup')) ? 'rollup' : 'formula',
        config: {
          cacheStrategy: 'periodic',
          cacheTtl: 3600,
        },
        expectedPerformance: {
          executionTime: Math.max(50, (currentPerformance?.executionTime || 1000) / 10),
          improvement: '10x faster',
          cacheHitRate: 0.95,
        },
      },
      recommendation: bottlenecks.length > 0
        ? `Optimize by: ${bottlenecks[0].suggestion}`
        : 'Formula is already well-optimized.',
    };
  }

  /**
   * Design a view based on purpose and collection
   */
  async designView(dto: DesignViewDto): Promise<ViewRecommendation> {
    const { purpose, preferredType, availableProperties } = dto;
    const purposeLower = purpose.toLowerCase();

    let viewType = preferredType || 'list';
    const config: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    const sorting: Array<{ field: string; direction: 'asc' | 'desc' }> = [];

    // Determine view type from purpose
    if (purposeLower.includes('board') || purposeLower.includes('kanban') || purposeLower.includes('status')) {
      viewType = 'kanban';
      const statusProp = availableProperties.find(p => p.name.includes('status'));
      if (statusProp) {
        config['columnProperty'] = statusProp.name;
      }
    } else if (purposeLower.includes('calendar') || purposeLower.includes('schedule') || purposeLower.includes('date')) {
      viewType = 'calendar';
      const dateProp = availableProperties.find(p => p.type === 'date' || p.type === 'datetime');
      if (dateProp) {
        config['dateProperty'] = dateProp.name;
      }
    } else if (purposeLower.includes('map') || purposeLower.includes('location')) {
      viewType = 'map';
      const locationProp = availableProperties.find(p => p.type === 'geolocation' || p.name.includes('location'));
      if (locationProp) {
        config['locationProperty'] = locationProp.name;
      }
    } else if (purposeLower.includes('timeline') || purposeLower.includes('gantt')) {
      viewType = 'timeline';
    } else if (purposeLower.includes('pivot') || purposeLower.includes('aggregate') || purposeLower.includes('summary')) {
      viewType = 'pivot';
    }

    // Add filters based on purpose
    if (purposeLower.includes('high priority')) {
      filters['priority'] = { operator: 'eq', value: 'High' };
    }
    if (purposeLower.includes('my ') || purposeLower.includes('assigned to me')) {
      filters['assigned_to'] = { operator: 'eq', value: 'CURRENT_USER' };
    }
    if (purposeLower.includes('overdue')) {
      filters['due_date'] = { operator: 'lt', value: 'TODAY()' };
    }

    // Add default sorting
    const priorityProp = availableProperties.find(p => p.name.includes('priority'));
    if (priorityProp) {
      sorting.push({ field: priorityProp.name, direction: 'desc' });
    }
    const dateProp = availableProperties.find(p => p.type === 'date' || p.type === 'datetime');
    if (dateProp) {
      sorting.push({ field: dateProp.name, direction: 'desc' });
    }

    return {
      name: this.generateViewName(purpose),
      type: viewType,
      config,
      filters,
      sorting,
      explanation: `Created a ${viewType} view for "${purpose}". ${Object.keys(filters).length > 0 ? `Applied ${Object.keys(filters).length} filter(s).` : ''}`,
    };
  }

  /**
   * Assess the impact of a schema change
   */
  async assessImpact(dto: AssessImpactDto): Promise<ImpactAssessment> {
    const { property, change } = dto;

    const assessment: ImpactAssessment = {
      breakingChanges: false,
      affectedRecords: 0,
      affectedProperties: [],
      affectedViews: [],
      affectedValidation: [],
      dataLoss: false,
      migrationStrategy: {
        recommended: 'safe',
        alternatives: [],
      },
    };

    // Check for breaking changes based on type conversion
    if (change.from === 'choice' && change.to === 'text') {
      assessment.breakingChanges = true;
      assessment.affectedViews.push({
        view: 'Kanban views',
        type: 'kanban',
        issue: 'Kanban boards require choice properties for columns',
      });
      assessment.affectedValidation.push({
        type: 'choice_constraint',
        issue: 'Text type allows any value, removing choice validation',
      });
      assessment.migrationStrategy.recommended = 'alternative_approach';
      assessment.migrationStrategy.alternatives = [
        {
          approach: 'Add more choices',
          description: 'Keep as choice property and add the new values needed',
          pros: ['No breaking changes', 'Preserves existing functionality'],
          cons: ['Still limited to predefined values'],
        },
        {
          approach: 'Add separate text property',
          description: 'Keep status as choice, add status_notes as text',
          pros: ['No breaking changes', 'Adds flexibility'],
          cons: ['Duplicated data concept'],
        },
      ];
    }

    if (change.from === 'text' && change.to === 'number') {
      assessment.dataLoss = true;
      assessment.affectedProperties.push({
        property,
        type: change.from,
        issue: 'Non-numeric text values will be lost or set to null',
      });
    }

    return assessment;
  }

  /**
   * Match user query to Phase 2 intent
   */
  matchIntent(query: string) {
    return matchIntent(query);
  }

  // Helper methods

  private inferPropertiesFromPurpose(purpose: string, _domain?: string): PropertyRecommendation[] {
    const properties: PropertyRecommendation[] = [];
    const purposeLower = purpose.toLowerCase();

    // Add common properties based on domain keywords
    if (purposeLower.includes('track') || purposeLower.includes('manage')) {
      properties.push(
        this.createPropertyRecommendation('title', 'Title', 'text', true, true),
        { ...PROPERTY_TYPE_TEMPLATES['status'] },
      );
    }

    if (purposeLower.includes('order') || purposeLower.includes('transaction')) {
      properties.push(
        this.createPropertyRecommendation('amount', 'Amount', 'currency', true, false),
        this.createPropertyRecommendation('date', 'Date', 'datetime', true, true),
      );
    }

    // Always add timestamps
    properties.push(
      { ...PROPERTY_TYPE_TEMPLATES['created_at'] },
      { ...PROPERTY_TYPE_TEMPLATES['updated_at'] },
    );

    return properties;
  }

  private inferRelationships(purpose: string, existingCollections: string[]): RelationshipRecommendation[] {
    const relationships: RelationshipRecommendation[] = [];
    const purposeLower = purpose.toLowerCase();

    for (const collection of existingCollections) {
      const collectionLower = collection.toLowerCase();
      if (purposeLower.includes(collectionLower) || collectionLower.includes(purposeLower.split(' ')[0])) {
        relationships.push({
          type: 'belongs_to' as const,
          targetCollection: collection,
          property: collectionLower,
          description: `Reference to ${collection}`,
        });
      }
    }

    return relationships;
  }

  private generateCollectionName(purpose: string): { code: string; display: string } {
    const words = purpose.toLowerCase().split(/\s+/);
    const keyWords = words.filter(w => !['a', 'an', 'the', 'for', 'to', 'and', 'or', 'of'].includes(w));
    const code = keyWords.slice(0, 3).join('_');
    const display = keyWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { code, display };
  }

  private generateViewName(purpose: string): string {
    return purpose
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private createPropertyRecommendation(
    name: string,
    displayName: string,
    type: string,
    required: boolean,
    indexed: boolean,
    extra?: Record<string, unknown>
  ): PropertyRecommendation {
    return {
      name,
      displayName,
      type,
      typeConfig: extra,
      required,
      indexed,
      description: `${displayName} field`,
      confidence: 0.8,
    };
  }

  private createDateDiffFormula(dateField: string, unit: string, availableProperties: Array<{ name: string; type: string }>): FormulaResult {
    const dateProps = availableProperties.filter(p => p.type === 'date' || p.type === 'datetime');
    const field = dateProps.find(p => p.name === dateField) ? dateField : (dateProps[0]?.name || 'created_at');

    return {
      formula: `DATEDIFF(${field}, TODAY(), "${unit}")`,
      explanation: `Calculates the number of ${unit} between ${field} and today`,
      resultType: 'number',
      dependencies: [field],
      cacheStrategy: 'periodic',
      cacheTtl: 86400,
      examples: [
        { input: 'Created yesterday', output: '1 day' },
        { input: 'Created last week', output: '7 days' },
      ],
    };
  }

  private createOverdueFormula(availableProperties: Array<{ name: string; type: string }>): FormulaResult {
    const dueDateProp = availableProperties.find(p => p.name.includes('due')) || { name: 'due_date' };
    const statusProp = availableProperties.find(p => p.name.includes('status')) || { name: 'status' };

    return {
      formula: `IF(AND(${dueDateProp.name} < TODAY(), ${statusProp.name} != "Completed"), true, false)`,
      explanation: 'Returns true if the due date has passed and status is not Completed',
      resultType: 'boolean',
      dependencies: [dueDateProp.name, statusProp.name],
      cacheStrategy: 'periodic',
      cacheTtl: 3600,
    };
  }

  private createTieredDiscountFormula(availableProperties: Array<{ name: string; type: string }>): FormulaResult {
    const amountProp = availableProperties.find(p => p.name.includes('amount') || p.name.includes('total')) || { name: 'total_amount' };

    return {
      formula: `SWITCH(
  TRUE,
  ${amountProp.name} >= 1000, ${amountProp.name} * 0.15,
  ${amountProp.name} >= 500, ${amountProp.name} * 0.10,
  ${amountProp.name} >= 250, ${amountProp.name} * 0.05,
  0
)`,
      explanation: 'Tiered discount: 15% for $1000+, 10% for $500+, 5% for $250+',
      resultType: 'number',
      dependencies: [amountProp.name],
      cacheStrategy: 'on_save',
      examples: [
        { input: '$1200', output: '$180 (15%)' },
        { input: '$600', output: '$60 (10%)' },
        { input: '$100', output: '$0' },
      ],
    };
  }

  private createPriorityScoreFormula(availableProperties: Array<{ name: string; type: string }>): FormulaResult {
    const priorityProp = availableProperties.find(p => p.name.includes('priority')) || { name: 'priority' };

    return {
      formula: `IF(${priorityProp.name} = "Critical", 100, IF(${priorityProp.name} = "High", 75, IF(${priorityProp.name} = "Medium", 50, 25)))`,
      explanation: 'Converts priority level to numeric score for sorting and aggregation',
      resultType: 'number',
      dependencies: [priorityProp.name],
      cacheStrategy: 'on_save',
      examples: [
        { input: 'Critical', output: '100' },
        { input: 'High', output: '75' },
        { input: 'Low', output: '25' },
      ],
    };
  }

  private createConcatFormula(availableProperties: Array<{ name: string; type: string }>): FormulaResult {
    const textProps = availableProperties.filter(p => p.type === 'text').slice(0, 2);
    const prop1 = textProps[0]?.name || 'first_name';
    const prop2 = textProps[1]?.name || 'last_name';

    return {
      formula: `CONCAT(${prop1}, " ", ${prop2})`,
      explanation: `Combines ${prop1} and ${prop2} with a space separator`,
      resultType: 'text',
      dependencies: [prop1, prop2],
      cacheStrategy: 'on_save',
      examples: [
        { input: 'John, Doe', output: 'John Doe' },
      ],
    };
  }
}
