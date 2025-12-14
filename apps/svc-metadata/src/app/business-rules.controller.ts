import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, TenantRequest, extractContext } from '@eam-platform/auth-guard';
import { Logger, InternalServerErrorException } from '@nestjs/common';
import { TenantDbService, PlatformScript } from '@eam-platform/tenant-db';
import type { ExecutionContext } from '@eam-platform/tenant-db';

// Business rules are stored as PlatformScript entries with scriptType='business_rule'
// The actionConfig is stored in conditionExpression, and rule type in executionContext

interface CreateBusinessRuleDto {
  code: string;
  name: string;
  description?: string;
  targetTable: string;
  ruleType: 'validation' | 'default_value' | 'calculated_field' | 'data_policy' | 'cascade';
  triggerEvents: ('insert' | 'update' | 'delete')[];
  triggerFields?: string[];
  conditionExpression?: Record<string, any>;
  actionConfig: Record<string, any>;
  executionOrder?: number;
  isAsync?: boolean;
  haltOnFailure?: boolean;
  isActive?: boolean;
}

// Map rule types to execution contexts
const ruleTypeToExecutionContext: Record<string, ExecutionContext> = {
  validation: 'before_insert',
  default_value: 'before_insert',
  calculated_field: 'before_update',
  data_policy: 'before_insert',
  cascade: 'after_update',
};

@Controller('admin/business-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class BusinessRulesController {
  private readonly logger = new Logger(BusinessRulesController.name);

  constructor(private readonly tenantDb: TenantDbService) {}

  @Get()
  async listRules(
    @Query('table') targetTable: string,
    @Query('type') ruleType: string,
    @Query('active') active: string,
    @Req() req: TenantRequest,
  ) {
    const ctx = extractContext(req);

    try {
      const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);

      const where: Record<string, unknown> = { scriptType: 'business_rule' };
      if (targetTable) where.targetTable = targetTable;
      if (active !== undefined) where.isActive = active === 'true';

      const rules = await repo.find({
        where,
        order: { executionOrder: 'ASC', createdAt: 'DESC' },
      });

      // Transform to business rule format
      const items = rules.map((rule) => ({
        id: rule.id,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        targetTable: rule.targetTable,
        ruleType: this.extractRuleType(rule),
        triggerEvents: this.extractTriggerEvents(rule),
        triggerFields: rule.targetField ? [rule.targetField] : [],
        conditionExpression: rule.conditionExpression,
        actionConfig: this.extractActionConfig(rule),
        executionOrder: rule.executionOrder,
        isAsync: rule.isAsync,
        haltOnFailure: !rule.isAsync, // Derived from isAsync
        source: rule.source,
        isActive: rule.isActive,
        isSystem: rule.isSystem,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }));

      // Filter by ruleType if specified
      const filteredItems = ruleType ? items.filter((item) => item.ruleType === ruleType) : items;

      return { data: filteredItems, total: filteredItems.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch business rules for tenant ${ctx.tenantId}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      // For admin users, provide more details; otherwise return a generic error
      if (ctx.isPlatformAdmin || ctx.isTenantAdmin) {
        throw new InternalServerErrorException(`Failed to fetch business rules: ${errorMessage}`);
      }
      throw new InternalServerErrorException('Failed to fetch business rules. Please try again later.');
    }
  }

  @Get(':id')
  async getRule(@Param('id') id: string, @Req() req: TenantRequest) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const rule = await repo.findOne({
      where: { id, scriptType: 'business_rule' },
    });

    if (!rule) {
      throw new NotFoundException('Business rule not found');
    }

    return {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      targetTable: rule.targetTable,
      ruleType: this.extractRuleType(rule),
      triggerEvents: this.extractTriggerEvents(rule),
      triggerFields: rule.targetField ? [rule.targetField] : [],
      conditionExpression: rule.conditionExpression,
      actionConfig: this.extractActionConfig(rule),
      executionOrder: rule.executionOrder,
      isAsync: rule.isAsync,
      haltOnFailure: !rule.isAsync,
      source: rule.source,
      isActive: rule.isActive,
      isSystem: rule.isSystem,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  @Post()
  async createRule(@Body() body: CreateBusinessRuleDto, @Req() req: TenantRequest) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Business rule with code "${body.code}" already exists`);
    }

    const executionContext = ruleTypeToExecutionContext[body.ruleType] || 'before_insert';

    // Store action config and metadata in script content as JSON
    const scriptContent = JSON.stringify({
      ruleType: body.ruleType,
      triggerEvents: body.triggerEvents,
      triggerFields: body.triggerFields,
      actionConfig: body.actionConfig,
      haltOnFailure: body.haltOnFailure !== false,
    });

    const rule = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      description: body.description,
      scriptType: 'business_rule',
      executionContext,
      targetTable: body.targetTable,
      targetField: body.triggerFields?.[0],
      scriptContent,
      scriptLanguage: 'javascript',
      executionOrder: body.executionOrder || 100,
      isAsync: body.isAsync || false,
      timeoutMs: 5000,
      conditionExpression: body.conditionExpression,
      source: 'tenant' as const,
      isActive: body.isActive !== false,
      isSystem: false,
      createdBy: ctx.userId,
    });

    const saved = await repo.save(rule);

    return {
      id: saved.id,
      code: saved.code,
      name: saved.name,
      description: saved.description,
      targetTable: saved.targetTable,
      ruleType: body.ruleType,
      triggerEvents: body.triggerEvents,
      triggerFields: body.triggerFields,
      conditionExpression: body.conditionExpression,
      actionConfig: body.actionConfig,
      executionOrder: saved.executionOrder,
      isAsync: saved.isAsync,
      haltOnFailure: body.haltOnFailure !== false,
      source: saved.source,
      isActive: saved.isActive,
      isSystem: saved.isSystem,
    };
  }

  @Patch(':id')
  async updateRule(@Param('id') id: string, @Body() body: Partial<CreateBusinessRuleDto>, @Req() req: TenantRequest) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const rule = await repo.findOne({
      where: { id, scriptType: 'business_rule' },
    });

    if (!rule) {
      throw new NotFoundException('Business rule not found');
    }

    if (rule.isSystem) {
      throw new ForbiddenException('Cannot modify system business rules');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== rule.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Business rule with code "${body.code}" already exists`);
      }
    }

    // Parse existing script content
    let existingConfig: any = {};
    try {
      existingConfig = JSON.parse(rule.scriptContent);
    } catch {
      existingConfig = {};
    }

    // Update script content with new values
    const updatedConfig = {
      ruleType: body.ruleType || existingConfig.ruleType,
      triggerEvents: body.triggerEvents || existingConfig.triggerEvents,
      triggerFields: body.triggerFields || existingConfig.triggerFields,
      actionConfig: body.actionConfig || existingConfig.actionConfig,
      haltOnFailure: body.haltOnFailure ?? existingConfig.haltOnFailure,
    };

    const updateData: Partial<PlatformScript> = {
      updatedBy: ctx.userId,
    };

    if (body.code) updateData.code = body.code;
    if (body.name) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.targetTable) updateData.targetTable = body.targetTable;
    if (body.triggerFields?.[0]) updateData.targetField = body.triggerFields[0];
    if (body.executionOrder !== undefined) updateData.executionOrder = body.executionOrder;
    if (body.isAsync !== undefined) updateData.isAsync = body.isAsync;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.conditionExpression) updateData.conditionExpression = body.conditionExpression;
    if (body.ruleType) {
      updateData.executionContext = ruleTypeToExecutionContext[body.ruleType] || rule.executionContext;
    }

    updateData.scriptContent = JSON.stringify(updatedConfig);

    const updated = repo.merge(rule, updateData);
    const saved = await repo.save(updated);

    return {
      id: saved.id,
      code: saved.code,
      name: saved.name,
      description: saved.description,
      targetTable: saved.targetTable,
      ruleType: updatedConfig.ruleType,
      triggerEvents: updatedConfig.triggerEvents,
      triggerFields: updatedConfig.triggerFields,
      conditionExpression: saved.conditionExpression,
      actionConfig: updatedConfig.actionConfig,
      executionOrder: saved.executionOrder,
      isAsync: saved.isAsync,
      haltOnFailure: updatedConfig.haltOnFailure,
      source: saved.source,
      isActive: saved.isActive,
      isSystem: saved.isSystem,
    };
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string, @Req() req: TenantRequest) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const rule = await repo.findOne({
      where: { id, scriptType: 'business_rule' },
    });

    if (!rule) {
      throw new NotFoundException('Business rule not found');
    }

    if (rule.isSystem) {
      throw new ForbiddenException('Cannot delete system business rules');
    }

    await repo.remove(rule);
    return { success: true };
  }

  @Post(':id/toggle')
  async toggleRule(@Param('id') id: string, @Req() req: TenantRequest) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const rule = await repo.findOne({
      where: { id, scriptType: 'business_rule' },
    });

    if (!rule) {
      throw new NotFoundException('Business rule not found');
    }

    rule.isActive = !rule.isActive;
    rule.updatedBy = ctx.userId;

    const saved = await repo.save(rule);

    return {
      id: saved.id,
      isActive: saved.isActive,
    };
  }

  @Post(':id/test')
  async testRule(
    @Param('id') id: string,
    @Body() body: { recordData: Record<string, unknown> },
    @Req() req: TenantRequest,
  ) {
    const ctx = extractContext(req);

    const repo = await this.tenantDb.getRepository<PlatformScript>(ctx.tenantId, PlatformScript);
    const rule = await repo.findOne({
      where: { id, scriptType: 'business_rule' },
    });

    if (!rule) {
      throw new NotFoundException('Business rule not found');
    }

    const ruleConfig = this.parseRuleConfig(rule);

    // Evaluate condition expression if present
    let conditionResult = true;
    if (rule.conditionExpression) {
      conditionResult = this.evaluateCondition(rule.conditionExpression, body.recordData);
    }

    // Simulate action execution
    let actionResult: any = null;
    if (conditionResult) {
      actionResult = this.simulateAction(ruleConfig.ruleType, ruleConfig.actionConfig, body.recordData);
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      conditionEvaluated: conditionResult,
      actionWouldExecute: conditionResult,
      actionResult,
      testData: body.recordData,
    };
  }

  // Helper methods

  private parseRuleConfig(rule: PlatformScript): any {
    try {
      return JSON.parse(rule.scriptContent);
    } catch {
      return {
        ruleType: 'validation',
        triggerEvents: [],
        actionConfig: {},
      };
    }
  }

  private extractRuleType(rule: PlatformScript): string {
    const config = this.parseRuleConfig(rule);
    return config.ruleType || 'validation';
  }

  private extractTriggerEvents(rule: PlatformScript): string[] {
    const config = this.parseRuleConfig(rule);
    return config.triggerEvents || [];
  }

  private extractActionConfig(rule: PlatformScript): Record<string, any> {
    const config = this.parseRuleConfig(rule);
    return config.actionConfig || {};
  }

  private evaluateCondition(expression: Record<string, any>, data: Record<string, any>): boolean {
    const { field, operator, value } = expression;
    const fieldValue = data[field];

    switch (operator) {
      case 'eq':
      case '==':
        return fieldValue === value;
      case 'ne':
      case '!=':
        return fieldValue !== value;
      case 'gt':
      case '>':
        return fieldValue > value;
      case 'gte':
      case '>=':
        return fieldValue >= value;
      case 'lt':
      case '<':
        return fieldValue < value;
      case 'lte':
      case '<=':
        return fieldValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);
      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.endsWith(value);
      case 'isNull':
        return fieldValue === null || fieldValue === undefined;
      case 'isNotNull':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return true;
    }
  }

  private simulateAction(
    ruleType: string,
    actionConfig: Record<string, any>,
    _data: Record<string, any>,
  ): any {
    switch (ruleType) {
      case 'validation':
        return {
          type: 'validation',
          message: actionConfig.errorMessage || 'Validation failed',
          severity: actionConfig.severity || 'error',
        };
      case 'default_value':
        return {
          type: 'default_value',
          field: actionConfig.targetField,
          value: actionConfig.defaultValue,
        };
      case 'calculated_field':
        return {
          type: 'calculated_field',
          field: actionConfig.targetField,
          expression: actionConfig.expression,
          result: '(calculated value would appear here)',
        };
      case 'data_policy':
        return {
          type: 'data_policy',
          action: actionConfig.action,
          fields: actionConfig.fields,
        };
      case 'cascade':
        return {
          type: 'cascade',
          targetTable: actionConfig.targetTable,
          action: actionConfig.cascadeAction,
          fieldMapping: actionConfig.fieldMapping,
        };
      default:
        return { type: 'unknown', config: actionConfig };
    }
  }
}
